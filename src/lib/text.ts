export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/(\d)[,.](\d)/g, "$1.$2")
    .replace(/(\d+(?:\.\d+)?)\s*(kg|kilo|kilos|quilo|quilos)\b/g, "$1kg")
    .replace(/(\d+(?:\.\d+)?)\s*(g|gr|grs|gramas)\b/g, "$1g")
    .replace(/(\d+(?:\.\d+)?)\s*(l|lt|lts|litro|litros)\b/g, "$1l")
    .replace(/(\d+(?:\.\d+)?)\s*(ml)\b/g, "$1ml")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(["de", "da", "do", "das", "dos", "e", "com", "para", "o", "a", "em", "tipo"]);

export function tokens(q: string): string[] {
  return normalize(q)
    .split(" ")
    .filter((t) => t && !STOP.has(t));
}

/** Todas as palavras da busca aparecem no nome do produto (prefixo de palavra). */
export function matchesAll(productName: string, qTokens: string[]): boolean {
  const words = normalize(productName).split(" ");
  return qTokens.every((t) => words.some((w) => w === t || (t.length >= 3 && w.startsWith(t))));
}

/** Produto "principal": a primeira palavra da busca aparece entre as 3 primeiras palavras do nome. */
export function isPrimary(productName: string, qTokens: string[]): boolean {
  if (!qTokens.length) return false;
  const words = normalize(productName).split(" ").slice(0, 3);
  const t = qTokens[0];
  return words.some((w) => w === t || (t.length >= 3 && w.startsWith(t)));
}
