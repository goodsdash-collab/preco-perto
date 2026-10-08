import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ipHash, rateLimit } from "@/lib/request";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ip = ipHash(req);
  const price = await prisma.communityPrice.findUnique({ where: { id: params.id }, select: { id: true, ipHash: true } });
  if (!price) return NextResponse.json({ error: "Preço não encontrado." }, { status: 404 });
  if (price.ipHash === ip) return NextResponse.json({ error: "Você mesmo registrou esse preço." }, { status: 400 });
  const already = await prisma.confirmation.findUnique({ where: { priceId_ipHash: { priceId: price.id, ipHash: ip } } });
  if (already) return NextResponse.json({ error: "Você já confirmou esse preço." }, { status: 400 });
  if (!(await rateLimit(ip, "confirm", 60, 60))) return NextResponse.json({ error: "Muitas confirmações seguidas." }, { status: 429 });
  const [, updated] = await prisma.$transaction([
    prisma.confirmation.create({ data: { priceId: price.id, ipHash: ip } }),
    prisma.communityPrice.update({ where: { id: price.id }, data: { confirmations: { increment: 1 }, lastConfirmedAt: new Date() }, select: { confirmations: true } }),
  ]);
  return NextResponse.json({ ok: true, confirmations: updated.confirmations });
}
