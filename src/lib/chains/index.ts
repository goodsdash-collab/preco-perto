import { gpaChain } from "./gpa";
import type { ChainAdapter } from "./types";
import { vtexChain } from "./vtex";

export const CHAINS: ChainAdapter[] = [
  vtexChain({
    key: "zonasul",
    name: "Zona Sul",
    host: "www.zonasul.com.br",
    osmMatch: /zona\s*sul/i,
    priceScope: "Preço do site Zona Sul (vale para a loja online no Rio). Pode variar na loja física.",
    simulateDelivery: true,
  }),
  vtexChain({
    key: "prezunic",
    name: "Prezunic",
    host: "www.prezunic.com.br",
    osmMatch: /prezunic/i,
    priceScope: "Preço do site Prezunic (região RJ). Pode variar na loja física.",
    simulateDelivery: true,
  }),
  vtexChain({
    key: "atacadao",
    name: "Atacadão",
    host: "www.atacadao.com.br",
    osmMatch: /atacad[aã]o/i,
    priceScope: "Preço do site Atacadão para a região do seu CEP. Pode variar na loja física.",
    regionalized: true,
    simulateDelivery: true,
  }),
  gpaChain(),
];

export function chainForStore(name: string, brand?: string | null): string | null {
  const s = `${brand || ""} ${name}`;
  for (const c of CHAINS) if (c.osmMatch.test(s)) return c.key;
  return null;
}
