"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const RIO = { lat: -22.9068, lon: -43.1729 };
const KEY = "pp:loc:v1";
const FOLLOW_KEY = "pp:follow";

export type LocSource = "gps" | "manual" | "salva" | "padrao" | "buscando";
export type Place = { bairro?: string | null; city?: string | null; uf?: string | null; cep?: string | null; label?: string | null };
export type Loc = {
  lat: number;
  lon: number;
  source: LocSource;
  accuracy?: number | null;
  at: number; // quando a posição foi obtida (ms)
  rev: number; // incrementa a cada nova posição
  force?: boolean; // ação explícita do usuário: refaz a busca mesmo sem ter se movido
  place?: Place | null;
  manualCep?: string | null; // CEP digitado (vai para a busca)
};

export function kmBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function geoErrorMessage(code: number | "unsupported"): string {
  if (code === 1)
    return "Sem permissão de localização. Para ativar no app Preço Perto: Configurações do Android › Apps › Preço Perto › Permissões › Localização › “Permitir durante o uso do app” (e ligue “Usar local exato”). No Chrome: toque no ícone ao lado do endereço do site › Permissões › Localização › Permitir. Confira também se a Localização do celular está ligada (barra de notificações › Localização). Enquanto isso, digite seu CEP ou endereço abaixo.";
  if (code === 2)
    return "Não conseguimos obter sua posição: a Localização do celular pode estar desligada ou o GPS está sem sinal. Ligue a Localização (modo de alta precisão) e toque em “Atualizar localização” de novo, ou digite seu CEP/endereço abaixo.";
  if (code === 3)
    return "O GPS não respondeu em 15 segundos. Tente perto de uma janela ou ao ar livre e toque em “Atualizar localização” de novo, ou digite seu CEP/endereço abaixo.";
  return "Este navegador não oferece localização. Digite seu CEP ou endereço abaixo.";
}

function save(l: Loc) {
  try {
    if (l.source === "gps" || l.source === "manual" || l.source === "salva")
      localStorage.setItem(KEY, JSON.stringify({ lat: l.lat, lon: l.lon, source: l.source === "salva" ? undefined : l.source, accuracy: l.accuracy, at: l.at, place: l.place, manualCep: l.manualCep }));
  } catch {}
}

function load(): (Partial<Loc> & { source?: LocSource }) | null {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) || "null");
    if (j && Number.isFinite(j.lat) && Number.isFinite(j.lon)) return j;
  } catch {}
  return null;
}

export function useLocation() {
  const [loc, setLocState] = useState<Loc>({ ...RIO, source: "buscando", at: 0, rev: 0 });
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [follow, setFollowState] = useState(false);
  const locRef = useRef(loc);
  locRef.current = loc;
  const reqId = useRef(0);

  const apply = useCallback((next: Omit<Loc, "rev">) => {
    setLocState((prev) => {
      const l = { ...next, rev: prev.rev + 1 };
      save(l);
      return l;
    });
  }, []);

  /** Leitura nova do GPS (alta precisão, sem cache). Sempre vence a localização salva. */
  const refresh = useCallback(
    (opts?: { silent?: boolean }) => {
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        setError(geoErrorMessage("unsupported"));
        setLocState((p) => (p.source === "buscando" ? { ...RIO, source: "padrao", at: Date.now(), rev: p.rev + 1 } : p));
        return;
      }
      const id = ++reqId.current;
      setLocating(true);
      if (!opts?.silent) setError(null);
      navigator.geolocation.getCurrentPosition(
        (p) => {
          if (id !== reqId.current) return;
          setLocating(false);
          setError(null);
          apply({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy, source: "gps", at: Date.now(), force: !opts?.silent, place: null, manualCep: null });
        },
        (e) => {
          if (id !== reqId.current) return;
          setLocating(false);
          setError(geoErrorMessage(e.code));
          // sem GPS e sem nada salvo: usa o centro do Rio
          setLocState((p) => (p.source === "buscando" ? { ...RIO, source: "padrao", at: Date.now(), rev: p.rev + 1, force: true } : p));
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
      );
    },
    [apply],
  );

  /** Endereço/CEP digitado pelo usuário. */
  const setManual = useCallback(
    (hit: { lat: number; lon: number; cep?: string | null; label: string; bairro?: string | null; city?: string | null; uf?: string | null }) => {
      reqId.current++; // descarta leitura de GPS em andamento
      setLocating(false);
      setError(null);
      setFollow(false);
      apply({ lat: hit.lat, lon: hit.lon, source: "manual", accuracy: null, at: Date.now(), force: true, manualCep: hit.cep || null, place: { label: hit.label, bairro: hit.bairro, city: hit.city, uf: hit.uf, cep: hit.cep } });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apply],
  );

  const setPlace = useCallback((place: Place, forRev: number) => {
    setLocState((p) => {
      if (p.rev !== forRev) return p;
      const l = { ...p, place };
      save(l);
      return l;
    });
  }, []);

  const setFollow = useCallback((on: boolean) => {
    setFollowState(on);
    try {
      localStorage.setItem(FOLLOW_KEY, on ? "1" : "0");
    } catch {}
  }, []);

  // Início: mostra a última localização salva na hora e pede uma leitura nova do GPS em seguida.
  useEffect(() => {
    const s = load();
    if (s) {
      setLocState((p) =>
        p.source === "buscando" // nunca sobrescreve uma leitura nova
          ? { lat: s.lat!, lon: s.lon!, source: s.source === "manual" ? "manual" : "salva", accuracy: s.accuracy ?? null, at: s.at || 0, rev: p.rev + 1, place: s.place || null, manualCep: s.source === "manual" ? s.manualCep || null : null }
          : p,
      );
    }
    let f = false;
    try {
      f = localStorage.getItem(FOLLOW_KEY) === "1";
    } catch {}
    if (f) setFollowState(true);
    // endereço digitado é escolha explícita: não troca pelo GPS sozinho (o botão Atualizar faz isso)
    if (!s || s.source !== "manual") refresh({ silent: !!s });
  }, [refresh]);

  // Seguir minha localização: atualiza quando andar mais de ~300 m (no máx. a cada 30 s)
  useEffect(() => {
    if (!follow || typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    let last = 0;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const cur = locRef.current;
        const pos = { lat: p.coords.latitude, lon: p.coords.longitude };
        if (p.coords.accuracy > 500) return; // leitura ruim demais para decidir
        const moved = cur.source === "buscando" || cur.source === "padrao" ? Infinity : kmBetween(cur, pos);
        const now = Date.now();
        if (moved > 0.3 && now - last > 30000) {
          last = now;
          setError(null);
          apply({ ...pos, accuracy: p.coords.accuracy, source: "gps", at: now, force: false, place: null, manualCep: null });
        }
      },
      (e) => {
        setError(geoErrorMessage(e.code));
        if (e.code === 1) setFollow(false);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [follow, apply, setFollow]);

  return { loc, locating, error, setError, refresh, setManual, setPlace, follow, setFollow };
}
