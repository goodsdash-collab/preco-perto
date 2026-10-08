import { cached, fetchWithTimeout, UA } from "./cache";
import { haversineKm } from "./geo";
import type { GeoCtx } from "./chains/types";

// Referências para quando o Nominatim falhar (cidade, UF, CEP central)
const FALLBACK: { lat: number; lon: number; city: string; uf: string; cep: string }[] = [
  { lat: -22.9068, lon: -43.1729, city: "Rio de Janeiro", uf: "RJ", cep: "20040002" },
  { lat: -22.8832, lon: -43.1034, city: "Niterói", uf: "RJ", cep: "24020000" },
  { lat: -23.5505, lon: -46.6333, city: "São Paulo", uf: "SP", cep: "01001000" },
  { lat: -23.6639, lon: -46.5383, city: "Santo André", uf: "SP", cep: "09010000" },
  { lat: -22.9099, lon: -47.0626, city: "Campinas", uf: "SP", cep: "13010000" },
  { lat: -21.1775, lon: -47.8103, city: "Ribeirão Preto", uf: "SP", cep: "14010000" },
  { lat: -19.9167, lon: -43.9345, city: "Belo Horizonte", uf: "MG", cep: "30130010" },
  { lat: -25.4284, lon: -49.2733, city: "Curitiba", uf: "PR", cep: "80010000" },
  { lat: -23.3045, lon: -51.1696, city: "Londrina", uf: "PR", cep: "86010000" },
  { lat: -27.5954, lon: -48.548, city: "Florianópolis", uf: "SC", cep: "88010000" },
  { lat: -30.0346, lon: -51.2177, city: "Porto Alegre", uf: "RS", cep: "90010000" },
  { lat: -20.3155, lon: -40.3128, city: "Vitória", uf: "ES", cep: "29010000" },
  { lat: -12.9714, lon: -38.5014, city: "Salvador", uf: "BA", cep: "40020000" },
  { lat: -10.9472, lon: -37.0731, city: "Aracaju", uf: "SE", cep: "49010000" },
  { lat: -15.7939, lon: -47.8828, city: "Brasília", uf: "DF", cep: "70040000" },
  { lat: -16.6869, lon: -49.2648, city: "Goiânia", uf: "GO", cep: "74003010" },
  { lat: -8.0476, lon: -34.877, city: "Recife", uf: "PE", cep: "50010000" },
  { lat: -3.7319, lon: -38.5267, city: "Fortaleza", uf: "CE", cep: "60010000" },
];

const UF_BY_STATE: Record<string, string> = {
  acre: "AC", alagoas: "AL", amapa: "AP", amazonas: "AM", bahia: "BA", ceara: "CE", "distrito federal": "DF", "espirito santo": "ES", goias: "GO",
  maranhao: "MA", "mato grosso": "MT", "mato grosso do sul": "MS", "minas gerais": "MG", para: "PA", paraiba: "PB", parana: "PR", pernambuco: "PE",
  piaui: "PI", "rio de janeiro": "RJ", "rio grande do norte": "RN", "rio grande do sul": "RS", rondonia: "RO", roraima: "RR", "santa catarina": "SC",
  "sao paulo": "SP", sergipe: "SE", tocantins: "TO",
};

function fallback(lat: number, lon: number): GeoCtx {
  let best = FALLBACK[0];
  let bd = Infinity;
  for (const f of FALLBACK) {
    const d = haversineKm(lat, lon, f.lat, f.lon);
    if (d < bd) { bd = d; best = f; }
  }
  return bd < 50 ? { cep: best.cep, uf: best.uf, city: best.city } : { cep: null, uf: null, city: null };
}

/** CEP, UF e cidade da localização (Nominatim reverso, com cache por ~1 km). */
export async function geoFor(lat: number, lon: number): Promise<GeoCtx & { approx?: boolean }> {
  const key = `geo2:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  try {
    const { value } = await cached(key, 30 * 24 * 3600, async () => {
      const r = await fetchWithTimeout(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}&zoom=18&addressdetails=1`,
        { headers: { "User-Agent": UA, "Accept-Language": "pt-BR" } },
        4000,
      );
      if (!r.ok) throw new Error(`nominatim ${r.status}`);
      const j = (await r.json()) as { address?: Record<string, string> };
      const a = j.address || {};
      const pc = (a.postcode || "").replace(/\D/g, "");
      const cep = pc.length === 8 ? pc : pc.length === 5 ? pc + "000" : null;
      const iso = a["ISO3166-2-lvl4"] || "";
      const st = (a.state || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const uf = iso.startsWith("BR-") ? iso.slice(3) : UF_BY_STATE[st] || null;
      const city = a.city || a.town || a.municipality || a.village || null;
      return { cep, uf, city } as GeoCtx;
    });
    if (!value.cep || !value.uf) {
      const fb = fallback(lat, lon);
      return { cep: value.cep || fb.cep, uf: value.uf || fb.uf, city: value.city || fb.city, approx: !value.cep };
    }
    return value;
  } catch {
    return { ...fallback(lat, lon), approx: true };
  }
}
