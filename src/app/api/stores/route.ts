import { NextResponse } from "next/server";
import { parseLatLon } from "@/lib/geo";
import { ensureStores, nearbyStores } from "@/lib/osm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const u = new URL(req.url);
  const { lat, lon } = parseLatLon(u.searchParams.get("lat"), u.searchParams.get("lon"));
  const km = Math.min(8, Math.max(1, Number(u.searchParams.get("km")) || 4));
  const osm = await ensureStores(lat, lon, km);
  const stores = await nearbyStores(lat, lon, km);
  return NextResponse.json({ osm, stores: stores.slice(0, 300) });
}
