export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function dist(km: number | null | undefined) {
  if (km == null) return "online";
  if (km < 1) return `${Math.round(km * 1000 / 10) * 10} m`;
  return `${km.toFixed(1).replace(".", ",")} km`;
}

export function ago(iso: string | null | undefined) {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return "agora há pouco";
  const m = s / 60;
  if (m < 60) return `há ${Math.round(m)} min`;
  const h = m / 60;
  if (h < 24) return `há ${Math.round(h)} h`;
  const d = h / 24;
  if (d < 1.5) return "há 1 dia";
  return `há ${Math.round(d)} dias`;
}
