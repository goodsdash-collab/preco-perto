import { createHash } from "crypto";
import { prisma } from "./db";

export function ipHash(req: Request): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "0.0.0.0";
  return createHash("sha256").update(ip + (process.env.IP_SALT || "preco-perto")).digest("hex").slice(0, 32);
}

/** Retorna true se ainda está dentro do limite e registra o evento. */
export async function rateLimit(hash: string, kind: string, max: number, windowMin: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMin * 60_000);
  const n = await prisma.rateEvent.count({ where: { ipHash: hash, kind, createdAt: { gte: since } } });
  if (n >= max) return false;
  await prisma.rateEvent.create({ data: { ipHash: hash, kind } });
  return true;
}
