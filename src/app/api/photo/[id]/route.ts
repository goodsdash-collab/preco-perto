import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const p = await prisma.communityPrice.findUnique({ where: { id: params.id }, select: { photo: true, photoMime: true } });
  if (!p?.photo || !p.photoMime) return new Response("Não encontrado", { status: 404 });
  return new Response(new Uint8Array(p.photo), { headers: { "Content-Type": p.photoMime, "Cache-Control": "public, max-age=86400" } });
}
