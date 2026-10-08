import { cached, fetchWithTimeout, UA } from "../cache";
import type { ChainAdapter, ChainCtx, Delivery, Offer } from "./types";

type VtexProduct = {
  productName: string;
  link?: string;
  linkText?: string;
  items: {
    itemId: string;
    images?: { imageUrl: string }[];
    sellers: { sellerId: string; sellerName?: string; commertialOffer: { Price: number; ListPrice: number; AvailableQuantity: number } }[];
  }[];
};

const HEADERS = { "User-Agent": UA, Accept: "application/json" };

function toOffers(host: string, products: VtexProduct[]): Offer[] {
  const out: Offer[] = [];
  for (const p of products) {
    const item = p.items?.[0];
    if (!item) continue;
    const seller = item.sellers?.find((s) => s.commertialOffer?.AvailableQuantity > 0 && s.commertialOffer?.Price > 0);
    if (!seller) continue;
    const url = p.linkText ? `https://${host}/${p.linkText}/p` : (p.link || `https://${host}`).replace(/https:\/\/secure\./, "https://www.");
    out.push({
      product: p.productName,
      price: seller.commertialOffer.Price,
      listPrice: seller.commertialOffer.ListPrice,
      url,
      image: item.images?.[0]?.imageUrl,
      sku: item.itemId,
      seller: seller.sellerId,
    });
  }
  return out;
}

function formatEta(s: string | undefined | null): string | null {
  if (!s) return null;
  const m = s.match(/^(\d+)(bd|d|h|m)$/);
  if (!m) return s;
  const n = Number(m[1]);
  if (m[2] === "h") return `${n} h`;
  if (m[2] === "m") return `${n} min`;
  if (n === 0) return "hoje";
  if (m[2] === "bd") return n === 1 ? "1 dia útil" : `${n} dias úteis`;
  return n === 1 ? "1 dia" : `${n} dias`;
}

export function vtexChain(opts: {
  key: string;
  name: string;
  host: string;
  osmMatch: RegExp;
  priceScope: string;
  regionalized?: boolean; // usa intelligent-search com regionId do CEP
  simulateDelivery?: boolean;
}): ChainAdapter {
  const { host } = opts;

  async function regionId(cep: string): Promise<string | null> {
    const { value } = await cached(`vtexregion:${host}:${cep}`, 7 * 24 * 3600, async () => {
      const r = await fetchWithTimeout(`https://${host}/api/checkout/pub/regions?country=BRA&postalCode=${cep}`, { headers: HEADERS }, 5000);
      if (!r.ok) return null;
      const j = (await r.json()) as { id: string }[];
      return j?.[0]?.id ?? null;
    });
    return value;
  }

  return {
    key: opts.key,
    name: opts.name,
    site: `https://${host}`,
    osmMatch: opts.osmMatch,
    priceScope: opts.priceScope,
    async search(q: string, ctx: ChainCtx) {
      if (opts.regionalized && ctx.cep) {
        const rid = await regionId(ctx.cep).catch(() => null);
        if (rid) {
          const r = await fetchWithTimeout(
            `https://${host}/api/io/_v/api/intelligent-search/product_search/?query=${encodeURIComponent(q)}&count=24&regionId=${encodeURIComponent(rid)}&locale=pt-BR`,
            { headers: HEADERS },
            7000,
          );
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const j = (await r.json()) as { products: VtexProduct[] };
          return toOffers(host, j.products || []);
        }
      }
      const r = await fetchWithTimeout(
        `https://${host}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(q)}&_from=0&_to=23`,
        { headers: HEADERS },
        7000,
      );
      if (!r.ok && r.status !== 206) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as VtexProduct[];
      if (!Array.isArray(j)) throw new Error("resposta inesperada");
      return toOffers(host, j);
    },
    async delivery(offer: Offer, ctx: ChainCtx): Promise<Delivery> {
      const base: Delivery = { status: "consultar", url: `https://${host}` };
      if (!opts.simulateDelivery || !ctx.cep || !offer.sku) return base;
      const cep = ctx.cep;
      const { value } = await cached(`vtexdelivery:${host}:${cep}`, 3 * 3600, async () => {
        const r = await fetchWithTimeout(
          `https://${host}/api/checkout/pub/orderForms/simulation?sc=1`,
          {
            method: "POST",
            headers: { ...HEADERS, "Content-Type": "application/json" },
            body: JSON.stringify({ items: [{ id: offer.sku, quantity: 1, seller: offer.seller || "1" }], postalCode: ctx.cep, country: "BRA" }),
          },
          6000,
        );
        if (!r.ok) throw new Error(`simulation HTTP ${r.status}`);
        const j = (await r.json()) as {
          items?: { availability?: string }[];
          logisticsInfo?: { slas: { deliveryChannel?: string; price: number; shippingEstimate: string; name: string }[] }[];
        };
        const slas = (j.logisticsInfo || []).flatMap((l) => l.slas || []);
        const del = slas.filter((s) => s.deliveryChannel !== "pickup-in-point").sort((a, b) => a.price - b.price);
        if (del.length) {
          return { status: "sim", fee: del[0].price / 100, eta: formatEta(del[0].shippingEstimate), url: `https://${host}`, note: del[0].name } as Delivery;
        }
        if (j.items?.[0]?.availability === "available" && slas.length) {
          return { status: "nao", url: `https://${host}`, note: "Só retirada na loja para o seu CEP" } as Delivery;
        }
        throw new Error("simulação inconclusiva");
      }).catch((e) => {
        console.warn("delivery", host, cep, String(e?.message || e));
        return { value: base };
      });
      return value;
    },
  };
}
