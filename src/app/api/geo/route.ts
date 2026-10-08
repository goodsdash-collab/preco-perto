import { NextResponse } from "next/server";
import { geoFor } from "@/lib/cep";
import { parseLatLon } from "@/lib/geo";

export const dynamic = "force-dynamic";

/** Bairro, cidade, UF e CEP de uma coordenada (geocoding reverso com cache). */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const { lat, lon } = parseLatLon(u.searchParams.get("lat"), u.searchParams.get("lon"));
  const g = await geoFor(lat, lon);
  return NextResponse.json({ lat, lon, ...g });
}
