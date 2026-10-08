import { prisma } from "./db";

const mem = new Map<string, { v: unknown; exp: number }>();

export async function cached<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<{ value: T; hit: boolean }> {
  const now = Date.now();
  const m = mem.get(key);
  if (m && m.exp > now) return { value: m.v as T, hit: true };
  try {
    const row = await prisma.cacheEntry.findUnique({ where: { key } });
    if (row && row.expiresAt.getTime() > now) {
      mem.set(key, { v: row.value, exp: row.expiresAt.getTime() });
      return { value: row.value as T, hit: true };
    }
  } catch {
    /* cache indisponível: segue sem cache */
  }
  const value = await fn();
  const exp = now + ttlSec * 1000;
  mem.set(key, { v: value, exp });
  if (mem.size > 500) mem.delete(mem.keys().next().value as string);
  try {
    await prisma.cacheEntry.upsert({
      where: { key },
      create: { key, value: value as never, expiresAt: new Date(exp) },
      update: { value: value as never, expiresAt: new Date(exp) },
    });
  } catch {
    /* ignora */
  }
  return { value, hit: false };
}

export async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 7000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

export const UA = "PrecoPerto/0.1 (+https://github.com/goodsdash-collab/preco-perto)";
