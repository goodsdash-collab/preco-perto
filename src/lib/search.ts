import { prisma } from "./db";
import { cached } from "./cache";
import { CHAINS } from "./chains";
import type { ChainAdapter, Delivery, GeoCtx, Local, Offer, PriceScope } from "./chains/types";
import { geoFor } from "./cep";
import { ensureStores, nearbyStores, type NearStore } from "./osm";
import { isPrimary, matchesAll, normalize, tokens } from "./text";
import { classify, type Niche } from "./categories";

export type PriceEntry = {
  source: "site" | "comunidade";
  product: string;
  price: number;
  listPrice?: number;
  url?: string;
  image?: string;
  at: string;
  scope?: PriceScope;
  id?: string;
  confirmations?: number;
  lastConfirmedAt?: string | null;
  hasPhoto?: boolean;
};

export type ResultItem = {
  id: string;
  store: NearStore | null;
  chain: { key: string; name: string; site: string; priceScope: string; scope: PriceScope; note?: string } | null;
  distanceKm: number | null;
  outsideRadius?: boolean;
  best: PriceEntry;
  entries: PriceEntry[];
  delivery: Delivery;
};

export type ChainStatus = {
  key: string;
  name: string;
  status: "ok" | "sem resultado" | "erro" | "fora da área";
  error?: string;
  count: number;
  scope?: PriceScope;
  fetchedAt?: string;
  nearbyStores: number;
  ms: number;
};

const PER_CHAIN_STORES = 3;
const CHAIN_BUDGET_MS = 7000;
const WIDEN_KM = 8;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("tempo esgotado")), ms))]);
}

function pickOffers(offers: Offer[], qTokens: string[]): Offer[] {
  let m = offers.filter((o) => matchesAll(o.product, qTokens));
  const primary = m.filter((o) => isPrimary(o.product, qTokens));
  if (primary.length) m = primary;
  return m.sort((a, b) => a.price - b.price).slice(0, 5);
}

type ChainRun = {
  c: ChainAdapter;
  status: ChainStatus;
  offers: Offer[];
  local: Local | null;
  fetchedAt: string;
  delivery: Delivery;
};

async function runChain(c: ChainAdapter, q: string, qNorm: string, qTokens: string[], geo: GeoCtx): Promise<ChainRun> {
  const t0 = Date.now();
  const base = { key: c.key, name: c.name, nearbyStores: 0 };
  try {
    return await withTimeout(
      (async () => {
        const local = await c.prepare(geo);
        if (!local.serves) {
          return { c, offers: [], local, fetchedAt: "", delivery: { status: "consultar", url: c.site } as Delivery, status: { ...base, status: "fora da área", count: 0, ms: Date.now() - t0 } as ChainStatus };
        }
        const loc = local.regionId || local.storeId || "-";
        const { value } = await cached(`chain2:${c.key}:${qNorm}:${loc}`, 15 * 60, async () => ({ offers: await c.search(q, local), fetchedAt: new Date().toISOString() }));
        const offers = pickOffers(value.offers, qTokens);
        let delivery: Delivery = { status: "consultar", url: c.site };
        if (offers.length) {
          delivery = await withTimeout(c.delivery(offers[0], geo, local), 4000).catch(() => ({ status: "consultar", url: c.site }) as Delivery);
        }
        const status: ChainStatus = { ...base, status: offers.length ? "ok" : "sem resultado", count: offers.length, scope: local.scope, fetchedAt: value.fetchedAt, ms: Date.now() - t0 };
        return { c, offers, local, fetchedAt: value.fetchedAt, delivery, status };
      })(),
      CHAIN_BUDGET_MS,
    );
  } catch (err) {
    return { c, offers: [], local: null, fetchedAt: "", delivery: { status: "consultar", url: c.site }, status: { ...base, status: "erro", error: String((err as Error)?.message || err), count: 0, ms: Date.now() - t0 } };
  }
}

function inStates(c: ChainAdapter, uf: string | null) {
  const s = c.def.states;
  return s === "*" || (!!uf && s.includes(uf));
}

export async function runSearch(q: string, lat: number, lon: number, km: number) {
  const t0 = Date.now();
  const qTokens = tokens(q);
  const qNorm = normalize(q);
  const niches = classify(q);
  const fitsNiche = (c: ChainAdapter) => c.def.niches.some((n) => niches.includes(n));

  // Geo (CEP/UF) e lojas do OSM em paralelo; as redes da UF começam assim que o CEP chega.
  const geoP = geoFor(lat, lon);
  const storesP = ensureStores(lat, lon, km).then(async (osm) => ({ osm, stores: await nearbyStores(lat, lon, km) }));

  const geo = await geoP;
  const launched = new Map<string, Promise<ChainRun>>();
  for (const c of CHAINS) if (fitsNiche(c) && inStates(c, geo.uf)) launched.set(c.key, runChain(c, q, qNorm, qTokens, geo));

  const storesRes = await storesP;
  const osm = storesRes.osm;
  let stores = storesRes.stores;
  // Redes com loja física por perto mas fora da lista da UF (ex.: Muffato no oeste de SP)
  for (const c of CHAINS) {
    if (fitsNiche(c) && !launched.has(c.key) && stores.some((s) => s.chain === c.key)) launched.set(c.key, runChain(c, q, qNorm, qTokens, geo));
  }
  const chainOut = await Promise.all(launched.values());

  // Amplia o raio quando há poucas lojas físicas com preço
  let widenedKm: number | null = null;
  const pricedChains = new Set(chainOut.filter((r) => r.offers.length).map((r) => r.c.key));
  const pricedNearby = stores.filter((s) => s.chain && pricedChains.has(s.chain)).length;
  if (pricedNearby < 3 && km < WIDEN_KM && pricedChains.size && Date.now() - t0 < 6000) {
    const w = await withTimeout(ensureStores(lat, lon, WIDEN_KM), 4000).catch(() => null);
    if (w?.ok) {
      const wide = await nearbyStores(lat, lon, WIDEN_KM);
      const ids = new Set(stores.map((s) => s.id));
      const extra = wide.filter((s) => !ids.has(s.id) && s.chain && pricedChains.has(s.chain));
      if (extra.length) {
        widenedKm = WIDEN_KM;
        stores = [...stores, ...extra];
      }
    }
  }

  for (const r of chainOut) r.status.nearbyStores = stores.filter((s) => s.chain === r.c.key).length;

  // Preços da comunidade nas lojas próximas (últimos 60 dias)
  const storeIds = stores.map((s) => s.id);
  const community =
    qTokens.length && storeIds.length
      ? await prisma.communityPrice.findMany({
          where: {
            storeId: { in: storeIds },
            observedAt: { gte: new Date(Date.now() - 60 * 24 * 3600 * 1000) },
            AND: qTokens.map((t) => ({ productNorm: { contains: t } })),
          },
          select: { id: true, product: true, price: true, storeId: true, observedAt: true, confirmations: true, lastConfirmedAt: true, photoMime: true },
          orderBy: { price: "asc" },
          take: 300,
        })
      : [];

  const byStore = new Map<string, ResultItem>();
  const storeMap = new Map(stores.map((s) => [s.id, s]));
  const results: ResultItem[] = [];

  for (const co of chainOut) {
    if (!co.offers.length || !co.local) continue;
    const entries: PriceEntry[] = co.offers.map((o) => ({ source: "site", product: o.product, price: o.price, listPrice: o.listPrice, url: o.url, image: o.image, at: co.fetchedAt, scope: co.local!.scope }));
    const chainInfo = { key: co.c.key, name: co.c.name, site: co.c.site, priceScope: co.local.label, scope: co.local.scope, note: co.c.def.note };
    const near = stores.filter((s) => s.chain === co.c.key).slice(0, PER_CHAIN_STORES);
    if (near.length) {
      for (const s of near) {
        const item: ResultItem = { id: s.id, store: s, chain: chainInfo, distanceKm: s.distanceKm, outsideRadius: s.distanceKm > km, best: entries[0], entries: [...entries], delivery: co.delivery };
        byStore.set(s.id, item);
        results.push(item);
      }
    } else {
      results.push({ id: `online:${co.c.key}`, store: null, chain: chainInfo, distanceKm: null, best: entries[0], entries, delivery: co.delivery });
    }
  }

  for (const cp of community) {
    const entry: PriceEntry = {
      source: "comunidade",
      product: cp.product,
      price: cp.price,
      at: cp.observedAt.toISOString(),
      id: cp.id,
      confirmations: cp.confirmations,
      lastConfirmedAt: cp.lastConfirmedAt?.toISOString() ?? null,
      hasPhoto: !!cp.photoMime,
    };
    let item = byStore.get(cp.storeId);
    if (!item) {
      const s = storeMap.get(cp.storeId)!;
      const c = CHAINS.find((x) => x.key === s.chain);
      item = {
        id: s.id,
        store: s,
        chain: c ? { key: c.key, name: c.name, site: c.site, priceScope: "", scope: "loja" } : null,
        distanceKm: s.distanceKm,
        outsideRadius: s.distanceKm > km,
        best: entry,
        entries: [],
        delivery: { status: "consultar", url: c?.site || `https://www.google.com/search?q=${encodeURIComponent(s.name + " delivery")}` },
      };
      byStore.set(s.id, item);
      results.push(item);
    }
    item.entries.push(entry);
  }

  for (const r of results) {
    r.entries.sort((a, b) => a.price - b.price);
    r.best = r.entries[0];
  }
  results.sort((a, b) => a.best.price - b.best.price || (a.distanceKm ?? 999) - (b.distanceKm ?? 999));

  const consulted = chainOut.filter((r) => r.status.status !== "fora da área");
  const pricedIds = new Set(results.filter((r) => r.store).map((r) => r.store!.id));
  const unpriced = stores
    .filter((s) => niches.includes(s.niche as Niche) && !pricedIds.has(s.id) && s.distanceKm <= km)
    .slice(0, 12)
    .map((s) => ({ id: s.id, name: s.name, niche: s.niche, shop: s.shop, address: s.address, distanceKm: s.distanceKm, lat: s.lat, lon: s.lon }));
  return {
    query: q,
    center: { lat, lon },
    km,
    widenedKm,
    cep: geo.cep,
    uf: geo.uf,
    city: geo.city,
    osm,
    niches,
    unpriced,
    stores: stores.slice(0, 500).map((s) => ({ id: s.id, name: s.name, chain: s.chain, niche: s.niche, shop: s.shop, lat: s.lat, lon: s.lon, address: s.address, distanceKm: s.distanceKm })),
    results,
    consultedCount: consulted.length,
    pricedCount: consulted.filter((r) => r.offers.length).length,
    chains: chainOut.map((c) => c.status),
    ms: Date.now() - t0,
  };
}
