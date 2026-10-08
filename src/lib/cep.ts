import { cached, fetchWithTimeout, UA } from "./cache";
import { haversineKm } from "./geo";
import type { GeoCtx } from "./chains/types";

// Referências para quando o Nominatim falhar (cidade, UF, CEP central)
const FALLBACK: { lat: number; lon: number; city: string; uf: string; cep: string; range?: [number, number] }[] = [
  { lat: -22.9068, lon: -43.1729, city: "Rio de Janeiro", uf: "RJ", cep: "20040002", range: [20000, 23799] as [number, number] },
  { lat: -22.8832, lon: -43.1034, city: "Niterói", uf: "RJ", cep: "24020000", range: [24000, 24399] as [number, number] },
  { lat: -23.5505, lon: -46.6333, city: "São Paulo", uf: "SP", cep: "01001000", range: [1000, 8499] as [number, number] },
  { lat: -23.6639, lon: -46.5383, city: "Santo André", uf: "SP", cep: "09010000", range: [9000, 9299] as [number, number] },
  { lat: -22.9099, lon: -47.0626, city: "Campinas", uf: "SP", cep: "13010000", range: [13000, 13139] as [number, number] },
  { lat: -21.1775, lon: -47.8103, city: "Ribeirão Preto", uf: "SP", cep: "14010000", range: [14000, 14114] as [number, number] },
  { lat: -19.9167, lon: -43.9345, city: "Belo Horizonte", uf: "MG", cep: "30130010", range: [30000, 31999] as [number, number] },
  { lat: -25.4284, lon: -49.2733, city: "Curitiba", uf: "PR", cep: "80010000", range: [80000, 82999] as [number, number] },
  { lat: -23.3045, lon: -51.1696, city: "Londrina", uf: "PR", cep: "86010000", range: [86000, 86099] as [number, number] },
  { lat: -27.5954, lon: -48.548, city: "Florianópolis", uf: "SC", cep: "88010000", range: [88000, 88099] as [number, number] },
  { lat: -30.0346, lon: -51.2177, city: "Porto Alegre", uf: "RS", cep: "90010000", range: [90000, 91999] as [number, number] },
  { lat: -20.3155, lon: -40.3128, city: "Vitória", uf: "ES", cep: "29010000", range: [29000, 29099] as [number, number] },
  { lat: -12.9714, lon: -38.5014, city: "Salvador", uf: "BA", cep: "40020000", range: [40000, 42599] as [number, number] },
  { lat: -10.9472, lon: -37.0731, city: "Aracaju", uf: "SE", cep: "49010000", range: [49000, 49099] as [number, number] },
  { lat: -15.7939, lon: -47.8828, city: "Brasília", uf: "DF", cep: "70040000", range: [70000, 73699] as [number, number] },
  { lat: -16.6869, lon: -49.2648, city: "Goiânia", uf: "GO", cep: "74003010", range: [74000, 74899] as [number, number] },
  { lat: -8.0476, lon: -34.877, city: "Recife", uf: "PE", cep: "50010000", range: [50000, 52999] as [number, number] },
  { lat: -3.7319, lon: -38.5267, city: "Fortaleza", uf: "CE", cep: "60010000", range: [60000, 61599] as [number, number] },
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
  const key = `geo3:${lat.toFixed(3)}:${lon.toFixed(3)}`;
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
      const bairro = a.suburb || a.neighbourhood || a.quarter || a.city_district || null;
      return { cep, uf, city, bairro } as GeoCtx;
    });
    if (!value.cep || !value.uf) {
      const fb = fallback(lat, lon);
      return { cep: value.cep || fb.cep, uf: value.uf || fb.uf, city: value.city || fb.city, bairro: value.bairro, approx: !value.cep };
    }
    // Alguns endereços do OSM têm CEP errado (ex.: centro de Salvador marcado com CEP de Feira de Santana);
    // se a cidade é uma das conhecidas e o CEP cai fora da faixa dela, usa o CEP central da cidade.
    const known = FALLBACK.find((f) => f.city === value.city && f.range && haversineKm(lat, lon, f.lat, f.lon) < 60);
    if (known?.range) {
      const p5 = Number(value.cep.slice(0, 5));
      if (p5 < known.range[0] || p5 > known.range[1]) return { ...value, cep: known.cep, approx: true };
    }
    return value;
  } catch {
    return { ...fallback(lat, lon), approx: true };
  }
}

export type GeocodeHit = { lat: number; lon: number; cep: string | null; label: string; bairro: string | null; city: string | null; uf: string | null; precision: "rua" | "bairro" | "cidade" | "endereco" };

async function nominatimSearch(params: Record<string, string>) {
  const u = new URL("https://nominatim.openstreetmap.org/search");
  for (const [k, v] of Object.entries({ format: "jsonv2", addressdetails: "1", limit: "1", countrycodes: "br", ...params })) u.searchParams.set(k, v);
  const r = await fetchWithTimeout(u.toString(), { headers: { "User-Agent": UA, "Accept-Language": "pt-BR" } }, 6000);
  if (!r.ok) throw new Error(`nominatim ${r.status}`);
  const j = (await r.json()) as { lat: string; lon: string; display_name: string; address?: Record<string, string> }[];
  return j[0] || null;
}

/** Converte CEP (ViaCEP + Nominatim) ou endereço livre (Nominatim) em coordenadas. */
export async function geocodeQuery(raw: string): Promise<GeocodeHit | null> {
  const q = raw.trim().slice(0, 160);
  const digits = q.replace(/\D/g, "");
  const isCep = /^\d{5}-?\d{3}$/.test(q.replace(/\s/g, ""));
  if (isCep) {
    const { value } = await cached(`viacep:${digits}`, 30 * 24 * 3600, async () => {
      const r = await fetchWithTimeout(`https://viacep.com.br/ws/${digits}/json/`, { headers: { "User-Agent": UA } }, 6000);
      if (!r.ok) throw new Error(`viacep ${r.status}`);
      const j = (await r.json()) as { erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (j.erro) return null;
      const city = j.localidade || "";
      const uf = j.uf || "";
      const tries: [Record<string, string>, GeocodeHit["precision"]][] = [];
      if (j.logradouro) tries.push([{ street: j.logradouro, city, state: uf, country: "Brasil" }, "rua"]);
      if (j.bairro) tries.push([{ q: `${j.bairro}, ${city}, ${uf}` }, "bairro"]);
      tries.push([{ city, state: uf, country: "Brasil" }, "cidade"]);
      for (const [params, precision] of tries) {
        const hit = await nominatimSearch(params).catch(() => null);
        if (hit) {
          const label = [j.logradouro, j.bairro, city && `${city}/${uf}`].filter(Boolean).join(", ");
          return { lat: Number(hit.lat), lon: Number(hit.lon), cep: digits, label, bairro: j.bairro || null, city: city || null, uf: uf || null, precision } as GeocodeHit;
        }
      }
      return null;
    });
    return value;
  }
  const { value } = await cached(`geocode:${q.toLowerCase()}`, 30 * 24 * 3600, async () => {
    const hit = await nominatimSearch({ q });
    if (!hit) return null;
    const a = hit.address || {};
    const pc = (a.postcode || "").replace(/\D/g, "");
    const city = a.city || a.town || a.municipality || a.village || null;
    const bairro = a.suburb || a.neighbourhood || a.quarter || a.city_district || null;
    const iso = a["ISO3166-2-lvl4"] || "";
    const label = [a.road && [a.road, a.house_number].filter(Boolean).join(", "), bairro, city].filter(Boolean).join(" · ") || hit.display_name.split(",").slice(0, 3).join(",");
    return { lat: Number(hit.lat), lon: Number(hit.lon), cep: pc.length === 8 ? pc : null, label, bairro, city, uf: iso.startsWith("BR-") ? iso.slice(3) : null, precision: "endereco" } as GeocodeHit;
  });
  return value;
}
