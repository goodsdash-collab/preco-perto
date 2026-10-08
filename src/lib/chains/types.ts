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

export type GeoCtx = { cep: string | null; uf: string | null; city: string | null; bairro?: string | null };

export type PriceScope = "loja" | "regional" | "nacional";

/** Resultado da localização da rede para o CEP do usuário */
export type Local = {
  serves: boolean; // a rede atende essa região?
  scope: PriceScope;
  label: string; // texto explicando de onde vem o preço
  regionId?: string | null;
  storeId?: number | null;
  delivery?: Delivery | null; // já conhecido na localização (ex.: GPA)
};

export type ChainDef = {
  key: string;
  name: string;
  /** Nichos atendidos (mercado, farmacia, pet...) */
  niches: import("../categories").Niche[];
  platform: "vtex" | "gpa";
  host: string;
  /** UFs atendidas ("*" = nacional). Usado para decidir quais redes consultar. */
  states: string[] | "*";
  /** Regionalização VTEX: required = só consulta se a região do CEP tiver loja/seller; optional = usa se houver; none = não usa */
  region: "required" | "optional" | "none";
  search: "is" | "catalog";
  /** Simula frete no checkout público */
  simulate: boolean;
  /** Apelidos normalizados para casar com nome/marca no OpenStreetMap */
  osm: string[];
  /** Apelidos que NÃO são essa rede (ex.: "atacadao dia a dia") */
  osmNot?: string[];
  coverage: string; // descrição humana da área atendida
  note?: string; // observação exibida junto ao preço
};

export interface ChainAdapter {
  def: ChainDef;
  key: string;
  name: string;
  site: string;
  prepare(ctx: GeoCtx): Promise<Local>;
  search(q: string, local: Local): Promise<Offer[]>;
  delivery(offer: Offer, ctx: GeoCtx, local: Local): Promise<Delivery>;
}
