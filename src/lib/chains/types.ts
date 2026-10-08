export type Offer = {
  product: string;
  price: number;
  listPrice?: number;
  url: string;
  image?: string;
  sku?: string;
  seller?: string;
};

export type Delivery = {
  status: "sim" | "nao" | "consultar";
  fee?: number | null;
  eta?: string | null;
  url: string;
  note?: string;
};

export type ChainCtx = { cep?: string | null };

export interface ChainAdapter {
  key: string;
  name: string;
  site: string;
  /** Casa o nome/marca da loja no OpenStreetMap */
  osmMatch: RegExp;
  /** Explica o alcance do preço do site (loja, região ou nacional) */
  priceScope: string;
  search(q: string, ctx: ChainCtx): Promise<Offer[]>;
  delivery(offer: Offer, ctx: ChainCtx): Promise<Delivery>;
}
