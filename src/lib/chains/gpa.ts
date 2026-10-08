import { fetchWithTimeout, UA } from "../cache";
import type { ChainAdapter, Delivery, Offer } from "./types";

type GpaProduct = { name: string; price: number; stock: boolean; urlDetails: string; productImages?: string[]; sku?: string };

/** Pão de Açúcar (GPA) — API pública de busca usada pelo próprio site. */
export function gpaChain(): ChainAdapter {
  const storeId = 461; // loja de referência padrão do site
  return {
    key: "paodeacucar",
    name: "Pão de Açúcar",
    site: "https://www.paodeacucar.com",
    osmMatch: /p[aã]o de a[cç][uú]car/i,
    priceScope: "Preço do site do Pão de Açúcar (loja de referência do site, não necessariamente a loja do Rio). Pode variar na loja física.",
    async search(q: string) {
      const r = await fetchWithTimeout(
        "https://api.vendas.gpa.digital/pa/search/search",
        {
          method: "POST",
          headers: { "User-Agent": UA, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ terms: q, page: 1, sortBy: "relevance", resultsPerPage: 24, allowRedirect: true, storeId, department: "ecom", customerPlus: true, partner: "linx" }),
        },
        7000,
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
    async delivery(): Promise<Delivery> {
      return { status: "consultar", url: "https://www.paodeacucar.com", note: "Entrega pelo site/app Pão de Açúcar (taxa depende do endereço)" };
    },
  };
}
