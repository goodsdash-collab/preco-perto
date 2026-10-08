import { NextResponse } from "next/server";
import { parseLatLon } from "@/lib/geo";
import { runSearch } from "@/lib/search";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") || "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ error: "Digite pelo menos 2 letras." }, { status: 400 });
  const { lat, lon } = parseLatLon(u.searchParams.get("lat"), u.searchParams.get("lon"));
  const km = Math.min(8, Math.max(1, Number(u.searchParams.get("km")) || 4));
  try {
    const data = await runSearch(q, lat, lon, km);
    return NextResponse.json(data);
  } catch (err) {
    console.error("search error", err);
    return NextResponse.json({ error: "Não foi possível buscar agora. Tente de novo." }, { status: 500 });
  }
}
