"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import PriceForm from "./PriceForm";
import { ago, brl, dist } from "./format";
import type { PriceEntry, ResultItem, SearchData, StoreLite } from "./types";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-gray-200" /> });

const RIO = { lat: -22.9068, lon: -43.1729 };
const SUGESTOES = ["arroz 5kg", "leite integral", "feijão preto", "café 500g", "óleo de soja", "açúcar 1kg"];

type Loc = { lat: number; lon: number; source: "gps" | "padrao" | "buscando" };

function DeliveryLine({ r }: { r: ResultItem }) {
  const d = r.delivery;
  if (d.status === "sim") {
    return (
      <span className="text-green-700">
        🚚 Entrega{d.fee ? `: ${brl(d.fee)}` : " disponível (taxa no carrinho)"}{d.eta ? ` · ${d.eta}` : ""}
        <span className="text-gray-400"> · simulado no site para o seu CEP</span>
      </span>
    );
  }
  if (d.status === "nao") return <span className="text-gray-500">🚫 {d.note || "Sem entrega no seu CEP"}</span>;
  return (
    <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
      🚚 Entrega: consultar
    </a>
  );
}

function EntryRow({ e, onConfirm }: { e: PriceEntry; onConfirm: (id: string) => void }) {
  return (
    <div className="flex items-start justify-between gap-2 border-t py-2 text-sm first:border-t-0">
      <div className="min-w-0">
        <div className="truncate">
          {e.url ? (
            <a href={e.url} target="_blank" rel="noopener noreferrer" className="underline decoration-gray-300">{e.product}</a>
          ) : (
            e.product
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-gray-500">
          {e.source === "site" ? (
            <span className="rounded bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-700">site/online</span>
          ) : (
            <span className="rounded bg-violet-50 px-1.5 py-0.5 font-semibold text-violet-700">comunidade</span>
          )}
          <span>{e.source === "site" ? `lido ${ago(e.at)}` : `visto ${ago(e.at)}`}</span>
          {e.source === "comunidade" && e.hasPhoto && e.id && (
            <a href={`/api/photo/${e.id}`} target="_blank" rel="noopener noreferrer" className="underline">📷 foto</a>
          )}
          {e.source === "comunidade" && e.id && (
            <button onClick={() => onConfirm(e.id!)} className="rounded-full border border-violet-200 px-2 py-0.5 text-violet-700">
              👍 Ainda vale{e.confirmations ? ` (${e.confirmations})` : ""}
            </button>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-semibold">{brl(e.price)}</div>
        {e.listPrice && e.listPrice > e.price && <div className="text-xs text-gray-400 line-through">{brl(e.listPrice)}</div>}
      </div>
    </div>
  );
}

export default function App() {
  const [loc, setLoc] = useState<Loc>({ ...RIO, source: "buscando" });
  const [q, setQ] = useState("");
  const [km, setKm] = useState(4);
  const [sort, setSort] = useState<"preco" | "perto">("preco");
  const [data, setData] = useState<SearchData | null>(null);
  const [stores, setStores] = useState<StoreLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!("geolocation" in navigator)) return setLoc({ ...RIO, source: "padrao" });
    navigator.geolocation.getCurrentPosition(
      (p) => setLoc({ lat: p.coords.latitude, lon: p.coords.longitude, source: "gps" }),
      () => setLoc({ ...RIO, source: "padrao" }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, []);

  useEffect(() => {
    if (loc.source === "buscando") return;
    fetch(`/api/stores?lat=${loc.lat}&lon=${loc.lon}&km=${km}`)
      .then((r) => r.json())
      .then((j) => setStores(j.stores || []))
      .catch(() => {});
  }, [loc.lat, loc.lon, loc.source, km]);

  const [autoQ, setAutoQ] = useState<string | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("q");
    if (p) {
      setQ(p);
      setAutoQ(p);
    }
  }, []);

  const search = useCallback(
    async (term: string) => {
      const t = term.trim();
      if (t.length < 2) return;
      setLoading(true);
      setError(null);
      setSelected(null);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(t)}&lat=${loc.lat}&lon=${loc.lon}&km=${km}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Erro na busca");
        setData(j);
        if (j.stores?.length) setStores(j.stores);
        window.history.replaceState(null, "", `?q=${encodeURIComponent(t)}`);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [loc.lat, loc.lon, km],
  );

  useEffect(() => {
    if (autoQ && loc.source !== "buscando") {
      search(autoQ);
      setAutoQ(null);
    }
  }, [autoQ, loc.source, search]);

  async function confirm(id: string) {
    const r = await fetch(`/api/prices/${id}/confirm`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setToast(r.ok ? "Obrigado! Confirmação registrada." : j.error || "Não deu para confirmar.");
    if (r.ok && data) search(data.query);
    setTimeout(() => setToast(null), 3000);
  }

  const results = useMemo(() => {
    const list = [...(data?.results || [])];
    if (sort === "perto") list.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999) || a.best.price - b.best.price);
    else list.sort((a, b) => a.best.price - b.best.price || (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
    return list;
  }, [data, sort]);

  const cheapest = results.length ? Math.min(...results.map((r) => r.best.price)) : null;
  const center = data?.center || { lat: loc.lat, lon: loc.lon };
  const onSelect = useCallback((id: string) => {
    setSelected(id);
    document.getElementById(`r-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col">
      <header className="sticky top-0 z-[1000] bg-brand px-4 pb-3 pt-4 text-white shadow">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold tracking-tight">📍 Preço Perto</h1>
          <span className="text-xs text-white/80">mercados do Rio</span>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            search(q);
          }}
          className="mt-3 flex gap-2"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="O que você procura? Ex.: arroz 5kg"
            className="min-w-0 flex-1 rounded-xl px-3 py-3 text-base text-gray-900 outline-none"
            enterKeyHint="search"
          />
          <button className="rounded-xl bg-orange-500 px-4 font-bold">Buscar</button>
        </form>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-white/15 px-2 py-1">
            {loc.source === "gps" ? "📡 Sua localização" : loc.source === "buscando" ? "⏳ Localizando…" : "📍 Centro do Rio (padrão)"}
          </span>
          <select value={km} onChange={(e) => setKm(Number(e.target.value))} className="rounded-full bg-white/15 px-2 py-1 text-white">
            {[2, 4, 6, 8].map((k) => (
              <option key={k} value={k} className="text-black">
                até {k} km
              </option>
            ))}
          </select>
          <div className="ml-auto flex overflow-hidden rounded-full bg-white/15">
            <button onClick={() => setSort("preco")} className={`px-3 py-1 ${sort === "preco" ? "bg-white font-bold text-brand-dark" : ""}`}>Menor preço</button>
            <button onClick={() => setSort("perto")} className={`px-3 py-1 ${sort === "perto" ? "bg-white font-bold text-brand-dark" : ""}`}>Mais perto</button>
          </div>
        </div>
      </header>

      <section className="relative h-[42vh] min-h-[260px] w-full">
        <MapView center={center} stores={stores} results={results} selectedId={selected} onSelect={onSelect} />
      </section>

      <section className="flex-1 px-3 pb-24 pt-3">
        {!data && !loading && (
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm text-gray-700">Digite um produto e veja os mercados perto de você, o menor preço, a distância e se entregam.</p>
            <div className="flex flex-wrap gap-2">
              {SUGESTOES.map((s) => (
                <button key={s} onClick={() => { setQ(s); search(s); }} className="rounded-full bg-brand-soft px-3 py-1.5 text-sm text-brand-dark">
                  {s}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-500">{stores.length ? `${stores.length} mercados no mapa num raio de ${km} km.` : "Carregando mercados do mapa…"}</p>
          </div>
        )}

        {loading && <p className="p-4 text-center text-sm text-gray-600">Buscando preços nos sites e na comunidade…</p>}
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {data && !loading && (
          <>
            <div className="mb-2 flex flex-wrap gap-1 text-xs">
              {data.chains.map((c) => (
                <span key={c.key} title={c.error || ""} className={`rounded-full px-2 py-0.5 ${c.status === "ok" ? "bg-green-100 text-green-800" : c.status === "erro" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                  {c.status === "ok" ? "✓" : c.status === "erro" ? "⚠" : "–"} {c.name}
                </span>
              ))}
              {!data.osm.ok && <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-yellow-800">mapa de mercados indisponível agora</span>}
            </div>
            <p className="mb-3 text-sm text-gray-600">
              {results.length ? `${results.length} resultado(s) para "${data.query}"` : `Nenhum preço encontrado para "${data.query}" por perto.`}{" "}
              {data.cep ? <span className="text-gray-400">· CEP {data.cep.replace(/(\d{5})(\d{3})/, "$1-$2")}</span> : null}
            </p>
            {!results.length && (
              <button onClick={() => setShowForm(true)} className="mb-3 w-full rounded-xl border-2 border-dashed border-brand p-3 text-sm font-semibold text-brand-dark">
                Viu esse produto num mercado? Registre o preço
              </button>
            )}
            <ul className="space-y-3">
              {results.map((r) => {
                const name = r.store?.name || `${r.chain?.name} (loja online)`;
                const isOpen = open[r.id];
                const shown = isOpen ? r.entries : r.entries.slice(0, 1);
                return (
                  <li id={`r-${r.id}`} key={r.id} className={`rounded-2xl bg-white p-3 shadow-sm ring-2 ${selected === r.id ? "ring-brand" : "ring-transparent"}`} onClick={() => r.store && setSelected(r.id)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="truncate font-bold">{name}</h3>
                          {cheapest != null && r.best.price === cheapest && <span className="shrink-0 rounded bg-orange-100 px-1.5 text-xs font-bold text-orange-700">mais barato</span>}
                        </div>
                        <div className="text-xs text-gray-500">
                          {r.distanceKm != null ? `📍 ${dist(r.distanceKm)}` : "🌐 só online"}
                          {r.store?.address ? ` · ${r.store.address}` : ""}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xl font-extrabold text-brand-dark">{brl(r.best.price)}</div>
                      </div>
                    </div>
                    <div className="mt-1 text-xs">
                      <DeliveryLine r={r} />
                    </div>
                    <div className="mt-2">
                      {shown.map((e, i) => (
                        <EntryRow key={(e.id || e.url || "") + i} e={e} onConfirm={confirm} />
                      ))}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                      {r.entries.length > 1 && (
                        <button onClick={(ev) => { ev.stopPropagation(); setOpen((o) => ({ ...o, [r.id]: !o[r.id] })); }} className="font-semibold text-brand-dark">
                          {isOpen ? "Mostrar menos" : `Ver mais ${r.entries.length - 1} opção(ões)`}
                        </button>
                      )}
                      {r.store && (
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${r.store.lat},${r.store.lon}`} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
                          Como chegar
                        </a>
                      )}
                    </div>
                    {r.entries.some((e) => e.source === "site") && r.chain && (
                      <p className="mt-2 rounded-lg bg-gray-50 p-2 text-[11px] leading-snug text-gray-500">ℹ️ {r.chain.priceScope}</p>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-6 text-center text-[11px] text-gray-400">
              Preços “site/online” vêm das lojas virtuais (Zona Sul, Prezunic, Atacadão, Pão de Açúcar) e podem ser diferentes na loja física. Preços “comunidade” são enviados por usuários. Mapa © OpenStreetMap.
            </p>
          </>
        )}
      </section>

      {toast && <div className="fixed bottom-20 left-1/2 z-[2100] -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-sm text-white">{toast}</div>}

      <button onClick={() => setShowForm(true)} className="fixed bottom-4 right-4 z-[1500] rounded-full bg-orange-500 px-5 py-3 font-bold text-white shadow-lg">
        + Registrar preço
      </button>

      {showForm && (
        <PriceForm
          stores={stores}
          initialProduct={data?.query || q}
          onClose={() => setShowForm(false)}
          onSaved={(p) => {
            setShowForm(false);
            setToast("Preço registrado. Obrigado!");
            setTimeout(() => setToast(null), 3000);
            setQ(p);
            search(p);
          }}
        />
      )}
    </main>
  );
}
