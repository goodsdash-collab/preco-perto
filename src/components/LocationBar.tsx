"use client";

import { useEffect, useState } from "react";
import type { Loc } from "./useLocation";

function since(at: number, now: number) {
  if (!at) return "";
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return "atualizada agora";
  const m = Math.round(s / 60);
  if (m < 60) return `atualizada há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `atualizada há ${h} h`;
  return `atualizada há ${Math.round(h / 24)} dias`;
}

function acc(a?: number | null) {
  if (!a) return null;
  if (a < 1000) return `±${Math.round(a)} m`;
  return `±${(a / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
}

function fmtCep(c?: string | null) {
  return c && c.length === 8 ? `${c.slice(0, 5)}-${c.slice(5)}` : null;
}

type Props = {
  loc: Loc;
  locating: boolean;
  error: string | null;
  follow: boolean;
  onRefresh: () => void;
  onFollow: (on: boolean) => void;
  onManual: (hit: { lat: number; lon: number; cep?: string | null; label: string; bairro?: string | null; city?: string | null; uf?: string | null }) => void;
};

export default function LocationBar({ loc, locating, error, follow, onRefresh, onFollow, onManual }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [addr, setAddr] = useState("");
  const [busy, setBusy] = useState(false);
  const [addrErr, setAddrErr] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (error) setOpen(true);
  }, [error]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = addr.trim();
    if (v.length < 3) return setAddrErr("Digite um CEP (8 números) ou um endereço.");
    setBusy(true);
    setAddrErr(null);
    try {
      const r = await fetch(`/api/geocode?q=${encodeURIComponent(v)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não encontramos esse endereço.");
      onManual(j);
      setOpen(false);
      setAddr("");
    } catch (err) {
      setAddrErr((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const p = loc.place || {};
  const where = p.label || [p.bairro, p.city && `${p.city}${p.uf ? `/${p.uf}` : ""}`].filter(Boolean).join(", ");
  const cep = fmtCep(p.cep || loc.manualCep);
  let icon = "📡";
  let title = where || "Sua localização";
  if (loc.source === "buscando") {
    icon = "⏳";
    title = "Localizando…";
  } else if (loc.source === "padrao") {
    icon = "📍";
    title = "Centro do Rio (padrão)";
  }
  else if (loc.source === "manual") icon = "🏠";
  else if (loc.source === "salva") icon = "🕘";
  const sub = [
    cep && `CEP ${cep}`,
    loc.source === "gps" || loc.source === "salva" ? acc(loc.accuracy) : null,
    loc.source === "manual" ? "endereço digitado" : loc.source === "salva" ? "última posição salva" : loc.source === "padrao" ? "sem GPS" : null,
    loc.source !== "buscando" && loc.source !== "padrao" ? since(loc.at, now) : null,
  ].filter(Boolean);
  const lowAcc = loc.source === "gps" && (loc.accuracy || 0) > 1000;

  return (
    <div className="border-b border-gray-100 bg-white px-3 py-2 text-sm" data-testid="location-bar">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-gray-900" data-testid="loc-label">
            {icon} {title}
          </div>
          <div className="truncate text-xs text-gray-500" data-testid="loc-sub">
            {locating ? "Obtendo posição do GPS…" : sub.join(" · ")}
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={locating}
          className="shrink-0 rounded-xl bg-brand px-3 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-70"
          data-testid="refresh-loc"
          aria-label="Atualizar localização"
        >
          {locating ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> Localizando…
            </span>
          ) : (
            "📍 Atualizar localização"
          )}
        </button>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <button onClick={() => setOpen((o) => !o)} className="text-blue-700 underline" data-testid="manual-toggle">
          ✏️ Usar endereço ou CEP
        </button>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-gray-700">
          <input type="checkbox" checked={follow} onChange={(e) => onFollow(e.target.checked)} className="h-4 w-4 accent-[#0f9d58]" data-testid="follow" />
          Seguir minha localização
        </label>
        {lowAcc && <span className="text-amber-700">Precisão baixa — ligue o GPS em alta precisão</span>}
      </div>
      {error && (
        <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900" data-testid="loc-error" role="alert">
          {error}
        </p>
      )}
      {open && (
        <form onSubmit={submit} className="mt-2 flex gap-2" data-testid="manual-form">
          <input
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            placeholder="CEP (ex.: 22070-011) ou endereço"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-base outline-none focus:border-brand"
            autoComplete="postal-code"
            enterKeyHint="go"
          />
          <button disabled={busy} className="shrink-0 rounded-lg bg-gray-900 px-3 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? "…" : "Usar"}
          </button>
        </form>
      )}
      {open && addrErr && <p className="mt-1 text-xs text-red-700">{addrErr}</p>}
    </div>
  );
}
