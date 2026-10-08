import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ipHash, rateLimit } from "@/lib/request";
import { normalize } from "@/lib/text";

export const dynamic = "force-dynamic";

const MAX_PHOTO = 1_500_000;

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
  }
  const product = String(form.get("product") || "").trim().replace(/\s+/g, " ");
  const price = Number(String(form.get("price") || "").replace(/\./g, "").replace(",", "."));
  const storeId = String(form.get("storeId") || "");
  const dateS = String(form.get("date") || "");
  const website = String(form.get("website") || ""); // honeypot

  if (website) return NextResponse.json({ ok: true });
  if (product.length < 2 || product.length > 120 || !/[a-zA-ZÀ-ú]{2}/.test(product)) {
    return NextResponse.json({ error: "Informe o nome do produto (ex.: Arroz Tio João 5kg)." }, { status: 400 });
  }
  if (!Number.isFinite(price) || price < 0.1 || price > 3000) {
    return NextResponse.json({ error: "Preço fora do normal. Confira o valor (entre R$ 0,10 e R$ 3.000)." }, { status: 400 });
  }
  const now = Date.now();
  const todaySP = new Date(now - 3 * 3600e3).toISOString().slice(0, 10);
  const observedAt = dateS && dateS !== todaySP ? new Date(`${dateS}T12:00:00-03:00`) : new Date(now);
  if (isNaN(observedAt.getTime()) || observedAt.getTime() > now + 24 * 3600e3 || observedAt.getTime() < now - 60 * 24 * 3600e3) {
    return NextResponse.json({ error: "A data precisa ser dos últimos 60 dias." }, { status: 400 });
  }
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return NextResponse.json({ error: "Escolha um mercado da lista." }, { status: 400 });

  let photo: Buffer | null = null;
  let photoMime: string | null = null;
  const file = form.get("photo");
  if (file && typeof file === "object" && "arrayBuffer" in file && (file as File).size > 0) {
    const f = file as File;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return NextResponse.json({ error: "A foto precisa ser JPG, PNG ou WEBP." }, { status: 400 });
    if (f.size > MAX_PHOTO) return NextResponse.json({ error: "Foto muito grande (máx. 1,5 MB)." }, { status: 400 });
    photo = Buffer.from(await f.arrayBuffer());
    photoMime = f.type;
  }

  const ip = ipHash(req);
  if (!(await rateLimit(ip, "price", 15, 60))) {
    return NextResponse.json({ error: "Muitos registros seguidos. Tente de novo daqui a pouco." }, { status: 429 });
  }
  // evita duplicata idêntica do mesmo IP no mesmo dia
  const dup = await prisma.communityPrice.findFirst({
    where: { ipHash: ip, storeId, productNorm: normalize(product), price, createdAt: { gte: new Date(now - 24 * 3600e3) } },
    select: { id: true },
  });
  if (dup) return NextResponse.json({ ok: true, id: dup.id, duplicate: true });

  const created = await prisma.communityPrice.create({
    data: { product, productNorm: normalize(product), price: Math.round(price * 100) / 100, storeId, observedAt, ipHash: ip, photo, photoMime },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: created.id });
}
