import { NextResponse } from "next/server";
import { geocodeQuery } from "@/lib/cep";
import { ipHash, rateLimit } from "@/lib/request";

export const dynamic = "force-dynamic";

/** Endereço ou CEP digitado → coordenadas (ViaCEP + Nominatim, com cache e limite por IP). */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (q.length < 3) return NextResponse.json({ error: "Digite um CEP (8 números) ou um endereço." }, { status: 400 });
  if (!(await rateLimit(ipHash(req), "geocode", 30, 60))) {
    return NextResponse.json({ error: "Muitas buscas de endereço seguidas. Tente de novo em alguns minutos." }, { status: 429 });
  }
  try {
    const hit = await geocodeQuery(q);
    if (!hit) return NextResponse.json({ error: "Não encontramos esse CEP/endereço. Confira e tente de novo (ex.: 22070-011 ou Rua Barata Ribeiro, 200, Copacabana)." }, { status: 404 });
    return NextResponse.json(hit);
  } catch (err) {
    console.error("geocode error", err);
    return NextResponse.json({ error: "O serviço de endereços não respondeu. Tente de novo." }, { status: 502 });
  }
}
