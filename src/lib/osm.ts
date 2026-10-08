import { prisma } from "./db";
import { fetchWithTimeout, UA } from "./cache";
import { bboxAround, haversineKm } from "./geo";
import { chainForStore } from "./chains";

const CELL = 0.05; // ~5,5 km
const CELL_TTL_MS = 7 * 24 * 3600 * 1000;
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

type OsmEl = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

export type NearStore = {
  id: string;
  name: string;
  brand: string | null;
  chain: string | null;
  shop: string;
  lat: number;
  lon: number;
  address: string | null;
  distanceKm: number;
};

function cellsFor(lat: number, lon: number, km: number) {
  const b = bboxAround(lat, lon, km);
  const keys: { key: string; s: number; w: number; n: number; e: number }[] = [];
  for (let i = Math.floor(b.south / CELL); i <= Math.floor(b.north / CELL); i++) {
    for (let j = Math.floor(b.west / CELL); j <= Math.floor(b.east / CELL); j++) {
      keys.push({ key: `${i}:${j}`, s: i * CELL, w: j * CELL, n: (i + 1) * CELL, e: (j + 1) * CELL });
    }
  }
  return keys;
}

async function overpass(s: number, w: number, n: number, e: number): Promise<OsmEl[]> {
  const q = `[out:json][timeout:25];(nwr["shop"~"^(supermarket|convenience|wholesale)$"](${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)}););out center tags;`;
  let lastErr: unknown = null;
  for (const ep of ENDPOINTS) {
    try {
      const r = await fetchWithTimeout(ep, {
        method: "POST",
        headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(q),
      }, 20000);
      const txt = await r.text();
      if (!r.ok || !txt.startsWith("{")) throw new Error(`overpass ${r.status}`);
      const j = JSON.parse(txt) as { elements: OsmEl[]; remark?: string };
      if (j.remark && /error/i.test(j.remark) && !j.elements?.length) throw new Error(j.remark);
      return j.elements || [];
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error("overpass indisponível");
}

export async function ensureStores(lat: number, lon: number, km: number): Promise<{ ok: boolean; error?: string }> {
  const cells = cellsFor(lat, lon, km);
  const existing = await prisma.areaCell.findMany({ where: { key: { in: cells.map((c) => c.key) } } });
  const fresh = new Set(existing.filter((c) => Date.now() - c.fetchedAt.getTime() < CELL_TTL_MS).map((c) => c.key));
  const missing = cells.filter((c) => !fresh.has(c.key));
  if (!missing.length) return { ok: true };
  const s = Math.min(...missing.map((c) => c.s));
  const w = Math.min(...missing.map((c) => c.w));
  const n = Math.max(...missing.map((c) => c.n));
  const e = Math.max(...missing.map((c) => c.e));
  try {
    const els = await overpass(s, w, n, e);
    const rows = els
      .map((el) => {
        const t = el.tags || {};
        const la = el.lat ?? el.center?.lat;
        const lo = el.lon ?? el.center?.lon;
        if (la == null || lo == null) return null;
        const name = t.name || t.brand;
        if (!name && t.shop === "convenience") return null;
        const addr = [t["addr:street"] && `${t["addr:street"]}${t["addr:housenumber"] ? ", " + t["addr:housenumber"] : ""}`, t["addr:suburb"]].filter(Boolean).join(" - ");
        return {
          id: `${el.type}/${el.id}`,
          name: name || "Mercado (sem nome no mapa)",
          brand: t.brand || t.operator || null,
          chain: chainForStore(name || "", t.brand, t.operator),
          shop: t.shop || "supermarket",
          lat: la,
          lon: lo,
          address: addr || null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    if (rows.length) await prisma.store.createMany({ data: rows, skipDuplicates: true });
    for (const c of missing) {
      await prisma.areaCell.upsert({ where: { key: c.key }, create: { key: c.key, count: rows.length }, update: { fetchedAt: new Date(), count: rows.length } });
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message || err) };
  }
}

export async function nearbyStores(lat: number, lon: number, km: number): Promise<NearStore[]> {
  const b = bboxAround(lat, lon, km);
  const rows = await prisma.store.findMany({
    where: { lat: { gte: b.south, lte: b.north }, lon: { gte: b.west, lte: b.east } },
    take: 3000,
  });
  return rows
    .map((r) => ({ id: r.id, name: r.name, brand: r.brand, chain: chainForStore(r.name, r.brand), shop: r.shop, lat: r.lat, lon: r.lon, address: r.address, distanceKm: haversineKm(lat, lon, r.lat, r.lon) }))
    .filter((r) => r.distanceKm <= km)
    .sort((a, b2) => a.distanceKm - b2.distanceKm);
}
