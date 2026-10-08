import { cached, fetchWithTimeout, UA } from "./cache";

/** CEP aproximado da localização (Nominatim reverso, com cache por ~1 km). */
export async function cepFor(lat: number, lon: number): Promise<string | null> {
  const key = `cep:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  try {
    const { value } = await cached(key, 30 * 24 * 3600, async () => {
      const r = await fetchWithTimeout(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}&zoom=18&addressdetails=1`,
        { headers: { "User-Agent": UA, "Accept-Language": "pt-BR" } },
        5000,
      );
      if (!r.ok) throw new Error(`nominatim ${r.status}`);
      const j = (await r.json()) as { address?: { postcode?: string } };
      const pc = (j.address?.postcode || "").replace(/\D/g, "");
      if (pc.length === 8) return pc;
      if (pc.length === 5) return pc + "000";
      return null;
    });
    return value;
  } catch {
    return null;
  }
}
