import { gpaChain } from "./gpa";
import { REGISTRY } from "./registry";
import type { ChainAdapter } from "./types";
import type { Niche } from "../categories";
import { vtexChain } from "./vtex";

export const CHAINS: ChainAdapter[] = REGISTRY.map((d) => (d.platform === "gpa" ? gpaChain(d) : vtexChain(d)));

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function lev1(a: string, b: string): boolean {
  // distância de edição <= 1
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

const COMMON = new Set(["atacado", "drogaria", "farmacia", "mercado", "supermercado", "mercadinho", "padaria", "materiais", "construcao"]);

/**
 * Casa um apelido com o texto: sequência exata de palavras, ou grupo de 1-3 palavras
 * consecutivas igual ao apelido sem espaços (ex.: "zonasul"), ou com 1 erro de digitação
 * para apelidos longos (ex.: "prezunik"). Nunca casa pedaço de palavra ("drogalife" ≠ "drogal").
 */
function aliasMatch(text: string, alias: string): boolean {
  if (` ${text} `.includes(` ${alias} `)) return true;
  const a = alias.replace(/ /g, "");
  const words = text.split(" ");
  for (let i = 0; i < words.length; i++) {
    let g = "";
    for (let k = i; k < Math.min(words.length, i + 3); k++) {
      g += words[k];
      if (g === a) return true;
      if (a.length >= 7 && !COMMON.has(g) && lev1(g, a)) return true;
    }
  }
  return false;
}

/** Descobre a rede de uma loja do OSM pelo nome/marca/operador (com apelidos e tolerância a 1 erro de digitação). */
export function chainForStore(name: string, brand?: string | null, operator?: string | null, niche?: Niche): string | null {
  const text = norm(`${brand || ""} ${name || ""} ${operator || ""}`);
  if (!text) return null;
  for (const c of REGISTRY) {
    if (niche && !c.niches.includes(niche) && !(niche === "outros" && c.key === "americanas")) continue;
    if (c.osmNot?.some((n) => text.includes(n))) continue;
    if (c.osm.some((a) => aliasMatch(text, a))) return c.key;
  }
  return null;
}
