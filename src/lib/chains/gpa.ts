import { cached, fetchWithTimeout, UA } from "../cache";
import type { ChainAdapter, ChainDef, Delivery, GeoCtx, Local, Offer } from "./types";

type GpaProduct = { name: string; price: number; stock: boolean; urlDetails: string; productImages?: string[]; sku?: string };
type DeliveryType = { storeName: string; name: string; price: string; day: string; ini: string; end: string; storeid: number; storeType?: string };

const API = "https://api.vendas.gpa.digital/pa";
const H = { "User-Agent": UA, Accept: "application/json" };

/** Pão de Açúcar (GPA): escolhe a loja que entrega no CEP (API pública de opções de entrega) e busca com o storeId dela. */
export function gpaChain(def: ChainDef): ChainAdapter {
  const site = "https://www.paodeacucar.com";
  return {
    def,
    key: def.key,
    name: def.name,
    site,
    async prepare(ctx: GeoCtx): Promise<Local> {
      if (!ctx.cep) return { serves: false, scope: "nacional", label: "CEP desconhecido" };
      const { value } = await cached(`gpa:delivery:${ctx.cep}`, 6 * 3600, async () => {
        const r = await fetchWithTimeout(`${API}/delivery-v2/ecom/deliveryOptions?zipCode=${ctx.cep}`, { headers: H }, 4000);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as { deliveryTypes?: DeliveryType[] };
        return (j.deliveryTypes || []).slice(0, 10);
      });
      if (!value.length) return { serves: false, scope: "nacional", label: "Fora da área atendida" };
      const sorted = [...value].sort((a, b) => Number(a.price) - Number(b.price));
      const first = value.find((v) => !/minuto/i.test(v.storeName) && !/minuto/i.test(v.storeType || "")) || value[0];
      const cheapest = sorted[0];
      const store = first.storeName.replace(/^\d+\s*-\s*/, "");
      const fee = Number(cheapest.price);
      return {
        serves: true,
        scope: "loja",
        storeId: first.storeid,
        label: `Preço da loja Pão de Açúcar ${store}, que entrega no seu CEP (pelo site).`,
        delivery: {
          status: "sim",
          fee: Number.isFinite(fee) ? fee : null,
          eta: `${cheapest.day.slice(0, 5)}, ${cheapest.ini}–${cheapest.end}`,
          url: site,
          note: `${cheapest.name.toLowerCase()} · loja ${cheapest.storeName.replace(/^\d+\s*-\s*/, "")}`,
        },
      };
    },
    async search(q: string, local: Local) {
      const r = await fetchWithTimeout(
        `${API}/search/search`,
        {
          method: "POST",
          headers: { ...H, "Content-Type": "application/json" },
          body: JSON.stringify({ terms: q, page: 1, sortBy: "relevance", resultsPerPage: 30, allowRedirect: true, storeId: local.storeId ?? 461, department: "ecom", customerPlus: true, partner: "linx" }),
        },
        6000,
      );
      if (r.status === 404) return [];
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as { products?: GpaProduct[] };
      return (j.products || [])
        .filter((p) => p.stock && p.price > 0)
        .map<Offer>((p) => ({
          product: p.name,
          price: p.price,
          url: p.urlDetails,
          image: p.productImages?.[0] ? `https://static.paodeacucar.com${p.productImages[0]}` : undefined,
          sku: p.sku,
        }));
    },
    async delivery(_o: Offer, _c: GeoCtx, local: Local): Promise<Delivery> {
      return local.delivery || { status: "consultar", url: site };
    },
  };
}
