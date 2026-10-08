import { prisma } from "./db";
import { cached } from "./cache";
import { CHAINS } from "./chains";
import type { Delivery, Offer } from "./chains/types";
import { cepFor } from "./cep";
import { ensureStores, nearbyStores, type NearStore } from "./osm";
import { isPrimary, matchesAll, normalize, tokens } from "./text";

export type PriceEntry = {
  source: "site" | "comunidade";
  product: string;
  price: number;
  listPrice?: number;
  url?: string;
  image?: string;
  at: string; // ISO: quando o preço foi lido (site) ou visto (comunidade)
  id?: string;
  confirmations?: number;
  lastConfirmedAt?: string | null;
  hasPhoto?: boolean;
};

export type ResultItem = {
  id: string;
  store: NearStore | null;
  chain: { key: string; name: string; site: string; priceScope: string } | null;
  distanceKm: number | null;
  best: PriceEntry;
  entries: PriceEntry[];
  delivery: Delivery;
};

export type ChainStatus = { key: string; name: string; status: "ok" | "sem resultado" | "erro"; error?: string; count: number; fetchedAt?: string; nearbyStores: number };

const PER_CHAIN_STORES = 3;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("tempo esgotado")), ms))]);
}

function pickOffers(offers: Offer[], qTokens: string[]): Offer[] {
  let m = offers.filter((o) => matchesAll(o.product, qTokens));
  const primary = m.filter((o) => isPrimary(o.product, qTokens));
  if (primary.length) m = primary;
  return m.sort((a, b) => a.price - b.price).slice(0, 5);
}

export async function runSearch(q: string, lat: number, lon: number, km: number) {
  const qTokens = tokens(q);
  const qNorm = normalize(q);

  const [osm, cep] = await Promise.all([ensureStores(lat, lon, km), cepFor(lat, lon)]);
  const stores = await nearbyStores(lat, lon, km);

  // 1) Preços dos sites (cada rede isolada, com timeout e cache curto)
  const chainOut = await Promise.all(
    CHAINS.map(async (c) => {
      const nearby = stores.filter((s) => s.chain === c.key);
      try {
        const { value } = await withTimeout(
          cached(`chain:${c.key}:${qNorm}:${cep || "-"}`, 15 * 60, async () => ({ offers: await c.search(q, { cep }), fetchedAt: new Date().toISOString() })),
          9000,
        );
        const offers = pickOffers(value.offers, qTokens);
        let delivery: Delivery = { status: "consultar", url: c.site };
        if (offers.length) {
          delivery = await withTimeout(c.delivery(offers[0], { cep }), 8000).catch(() => ({ status: "consultar", url: c.site }) as Delivery);
        }
        const status: ChainStatus = { key: c.key, name: c.name, status: offers.length ? "ok" : "sem resultado", count: offers.length, fetchedAt: value.fetchedAt, nearbyStores: nearby.length };
        return { c, offers, fetchedAt: value.fetchedAt, delivery, status, nearby };
      } catch (err) {
        const status: ChainStatus = { key: c.key, name: c.name, status: "erro", error: String((err as Error)?.message || err), count: 0, nearbyStores: nearby.length };
        return { c, offers: [] as Offer[], fetchedAt: "", delivery: { status: "consultar", url: c.site } as Delivery, status, nearby };
      }
    }),
  );

  // 2) Preços da comunidade nas lojas próximas (últimos 60 dias)
  const storeIds = stores.map((s) => s.id);
  const community = qTokens.length && storeIds.length
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
    if (!co.offers.length) continue;
    const entries: PriceEntry[] = co.offers.map((o) => ({ source: "site", product: o.product, price: o.price, listPrice: o.listPrice, url: o.url, image: o.image, at: co.fetchedAt }));
    const chainInfo = { key: co.c.key, name: co.c.name, site: co.c.site, priceScope: co.c.priceScope };
    if (co.nearby.length) {
      for (const s of co.nearby.slice(0, PER_CHAIN_STORES)) {
        const item: ResultItem = { id: s.id, store: s, chain: chainInfo, distanceKm: s.distanceKm, best: entries[0], entries: [...entries], delivery: co.delivery };
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
      const chainKey = s.chain;
      const c = CHAINS.find((x) => x.key === chainKey);
      item = {
        id: s.id,
        store: s,
        chain: c ? { key: c.key, name: c.name, site: c.site, priceScope: c.priceScope } : null,
        distanceKm: s.distanceKm,
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

  return {
    query: q,
    center: { lat, lon },
    km,
    cep,
    osm,
    stores: stores.slice(0, 300).map((s) => ({ id: s.id, name: s.name, chain: s.chain, shop: s.shop, lat: s.lat, lon: s.lon, address: s.address, distanceKm: s.distanceKm })),
    results,
    chains: chainOut.map((c) => c.status),
  };
}
