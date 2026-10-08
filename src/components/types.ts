export type StoreLite = { id: string; name: string; chain: string | null; shop: string; lat: number; lon: number; address: string | null; distanceKm: number };
export type PriceEntry = {
  source: "site" | "comunidade";
  product: string;
  price: number;
  listPrice?: number;
  url?: string;
  image?: string;
  at: string;
  id?: string;
  confirmations?: number;
  lastConfirmedAt?: string | null;
  hasPhoto?: boolean;
};
export type Delivery = { status: "sim" | "nao" | "consultar"; fee?: number | null; eta?: string | null; url: string; note?: string };
export type ResultItem = {
  id: string;
  store: StoreLite | null;
  chain: { key: string; name: string; site: string; priceScope: string } | null;
  distanceKm: number | null;
  best: PriceEntry;
  entries: PriceEntry[];
  delivery: Delivery;
};
export type ChainStatus = { key: string; name: string; status: "ok" | "sem resultado" | "erro"; error?: string; count: number; fetchedAt?: string; nearbyStores: number };
export type SearchData = {
  query: string;
  center: { lat: number; lon: number };
  km: number;
  cep: string | null;
  osm: { ok: boolean; error?: string };
  stores: StoreLite[];
  results: ResultItem[];
  chains: ChainStatus[];
};
