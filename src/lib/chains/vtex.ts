import { cached, fetchWithTimeout, UA } from "../cache";
import type { ChainAdapter, ChainDef, Delivery, GeoCtx, Local, Offer } from "./types";

type VtexProduct = {
  productName: string;
  link?: string;
  linkText?: string;
  items: {
    itemId: string;
    name?: string;
    nameComplete?: string;
    images?: { imageUrl: string }[];
    sellers: { sellerId: string; sellerName?: string; commertialOffer: { Price: number; ListPrice: number; AvailableQuantity: number } }[];
  }[];
};

const HEADERS = { "User-Agent": UA, Accept: "application/json" };

function toOffers(host: string, products: VtexProduct[]): Offer[] {
  const out: Offer[] = [];
  for (const p of products || []) {
    const items = p.items || [];
    for (const item of items.slice(0, 6)) {
      const seller = item.sellers?.find((s) => s.commertialOffer?.AvailableQuantity > 0 && s.commertialOffer?.Price >= 0.5);
      if (!seller) continue;
      // Produtos com variações (ex.: ração 3kg / 15kg) trazem o tamanho só no nome do SKU
      let name = p.productName;
      if (items.length > 1 && item.name && !name.toLowerCase().includes(item.name.toLowerCase())) {
        name = item.nameComplete && item.nameComplete.length > name.length ? item.nameComplete : `${name} ${item.name}`;
      }
      const url = p.linkText ? `https://${host}/${p.linkText}/p` : (p.link || `https://${host}`).replace(/https:\/\/secure\./, "https://www.");
      out.push({
        product: name,
        price: seller.commertialOffer.Price,
        listPrice: seller.commertialOffer.ListPrice,
        url,
        image: item.images?.[0]?.imageUrl,
        sku: item.itemId,
        seller: seller.sellerId,
      });
    }
  }
  return out;
}

export function formatEta(s: string | undefined | null): string | null {
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

function prettySeller(id: string, name: string, chainName: string): string | null {
  if (!name || name === id || /^[a-z0-9]+$/.test(name)) return null;
  const clean = name.replace(/\s*\|\s*/g, " – ").trim();
  return clean.toLowerCase().includes(chainName.toLowerCase().split(" ")[0]) ? clean : `${chainName} ${clean}`;
}

export function vtexChain(def: ChainDef): ChainAdapter {
  const { host } = def;
  const site = `https://${host}`;

  async function regions(cep: string): Promise<{ id: string; sellers: { id: string; name: string }[] } | null> {
    const { value } = await cached(`vtexregion2:${host}:${cep}`, 7 * 24 * 3600, async () => {
      const r = await fetchWithTimeout(`${site}/api/checkout/pub/regions?country=BRA&postalCode=${cep}`, { headers: HEADERS }, 4000);
      if (!r.ok) throw new Error(`regions HTTP ${r.status}`);
      const j = (await r.json()) as { id: string; sellers: { id: string; name: string }[] }[];
      return j?.[0] ? { id: j[0].id, sellers: j[0].sellers || [] } : { id: "", sellers: [] };
    });
    return value;
  }

  return {
    def,
    key: def.key,
    name: def.name,
    site,
    async prepare(ctx: GeoCtx): Promise<Local> {
      const national: Local = { serves: true, scope: "nacional", label: `Preço do site ${def.name} (o mesmo para todo o site). Pode variar na loja física.` };
      if (def.region === "none") {
        return def.states === "*" ? national : { ...national, scope: "regional", label: `Preço do site ${def.name} (${def.coverage}). Pode variar na loja física.` };
      }
      if (!ctx.cep) {
        return def.region === "required" ? { ...national, serves: def.states !== "*" } : national;
      }
      const reg = await regions(ctx.cep);
      const sellers = reg?.sellers || [];
      if (!sellers.length) {
        return def.region === "required" ? { serves: false, scope: "nacional", label: "Fora da área atendida" } : national;
      }
      if (sellers.length === 1) {
        const nm = prettySeller(sellers[0].id, sellers[0].name, def.name);
        return {
          serves: true,
          scope: "loja",
          regionId: reg!.id,
          label: nm ? `Preço da loja ${nm}, que atende o seu CEP.` : `Preço da loja ${def.name} que atende o seu CEP (site). Pode variar na loja física.`,
        };
      }
      return { serves: true, scope: "regional", regionId: reg!.id, label: `Preço do site ${def.name} para a região do seu CEP. Pode variar na loja física.` };
    },
    async search(q: string, local: Local) {
      if (def.search === "is") {
        const url = `${site}/api/io/_v/api/intelligent-search/product_search/?query=${encodeURIComponent(q)}&count=30&locale=pt-BR${local.regionId ? `&regionId=${encodeURIComponent(local.regionId)}` : ""}`;
        const r = await fetchWithTimeout(url, { headers: HEADERS }, 6000);
        if (r.ok) {
          const j = (await r.json()) as { products?: VtexProduct[] };
          return toOffers(host, j.products || []);
        }
        if (local.regionId) throw new Error(`HTTP ${r.status}`);
      }
      const r = await fetchWithTimeout(`${site}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(q)}&_from=0&_to=29`, { headers: HEADERS }, 6000);
      if (!r.ok && r.status !== 206) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as VtexProduct[];
      if (!Array.isArray(j)) throw new Error("resposta inesperada");
      return toOffers(host, j);
    },
    async delivery(offer: Offer, ctx: GeoCtx): Promise<Delivery> {
      const base: Delivery = { status: "consultar", url: site };
      if (!def.simulate || !ctx.cep || !offer.sku) return base;
      const cep = ctx.cep;
      const { value } = await cached(`vtexdelivery3:${host}:${cep}`, 3 * 3600, async () => {
        const r = await fetchWithTimeout(
          `${site}/api/checkout/pub/orderForms/simulation?sc=1`,
          {
            method: "POST",
            headers: { ...HEADERS, "Content-Type": "application/json" },
            body: JSON.stringify({ items: [{ id: offer.sku, quantity: 1, seller: offer.seller || "1" }], postalCode: cep, country: "BRA" }),
          },
          4000,
        );
        if (!r.ok) throw new Error(`simulation HTTP ${r.status}`);
        const j = (await r.json()) as {
          items?: { availability?: string }[];
          logisticsInfo?: { slas: { deliveryChannel?: string; price: number; shippingEstimate: string; name: string }[] }[];
        };
        const slas = (j.logisticsInfo || []).flatMap((l) => l.slas || []);
        const del = slas.filter((s) => s.deliveryChannel !== "pickup-in-point").sort((a, b) => a.price - b.price);
        if (del.length) return { status: "sim", fee: del[0].price / 100, eta: formatEta(del[0].shippingEstimate), url: site, note: del[0].name } as Delivery;
        if (j.items?.[0]?.availability === "available" && slas.length) return { status: "nao", url: site, note: "Só retirada na loja para o seu CEP" } as Delivery;
        throw new Error("simulação inconclusiva");
      }).catch(() => ({ value: base }));
      return value;
    },
  };
}
