"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PriceForm from "./PriceForm";
import LocationBar from "./LocationBar";
import { kmBetween, useLocation } from "./useLocation";
import { ago, brl, dist } from "./format";
import type { PriceEntry, ResultItem, SearchData, StoreLite } from "./types";
import { NICHE_INFO, type Niche } from "@/lib/categories";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-gray-200" /> });

const SUGESTOES = ["arroz 5kg", "dipirona", "ração golden 15kg", "pão francês", "cimento 50kg", "pastilha de freio", "fone bluetooth", "leite integral"];


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
            <>
              <span className="rounded bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-700">site/online</span>
              {e.scope && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">{e.scope === "loja" ? "preço da loja" : e.scope === "regional" ? "preço regional" : "preço nacional"}</span>}
            </>
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
  const { loc, locating, error: locError, refresh, setManual, setPlace, follow, setFollow } = useLocation();
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
  const [nicheFilter, setNicheFilter] = useState<string[] | null>(null);
  const [formStore, setFormStore] = useState<string | null>(null);

  // Lojas do mapa: recarrega quando a posição muda (~100 m) ou o raio muda
  const storesKey = loc.source === "buscando" ? "" : `${loc.lat.toFixed(3)},${loc.lon.toFixed(3)},${km}`;
  useEffect(() => {
    if (!storesKey) return;
    let alive = true;
    fetch(`/api/stores?lat=${loc.lat}&lon=${loc.lon}&km=${km}`)
      .then((r) => r.json())
      .then((j) => alive && setStores(j.stores || []))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storesKey]);

  // Bairro/cidade/CEP da posição (geocoding reverso), exceto endereço digitado que já tem rótulo
  useEffect(() => {
    if (loc.source === "buscando" || loc.source === "manual" || loc.place?.cep) return;
    const rev = loc.rev;
    fetch(`/api/geo?lat=${loc.lat}&lon=${loc.lon}`)
      .then((r) => r.json())
      .then((g) => setPlace({ bairro: g.bairro, city: g.city, uf: g.uf, cep: g.cep }, rev))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.rev]);

  const lastQuery = useRef<string | null>(null);
  const searchedAt = useRef<{ lat: number; lon: number; cep: string | null } | null>(null);
  const searchSeq = useRef(0);
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
      lastQuery.current = t;
      searchedAt.current = { lat: loc.lat, lon: loc.lon, cep: loc.manualCep || null };
      const seq = ++searchSeq.current;
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(t)}&lat=${loc.lat}&lon=${loc.lon}&km=${km}${loc.manualCep ? `&cep=${loc.manualCep}` : ""}`);
        const j = await r.json();
        if (seq !== searchSeq.current) return; // chegou uma busca mais nova
        if (!r.ok) throw new Error(j.error || "Erro na busca");
        setData(j);
        if (j.stores?.length) setStores(j.stores);
        setNicheFilter(j.niches || null);
        window.history.replaceState(null, "", `?q=${encodeURIComponent(t)}`);
      } catch (e) {
        if (seq === searchSeq.current) setError((e as Error).message);
      } finally {
        if (seq === searchSeq.current) setLoading(false);
      }
    },
    [loc.lat, loc.lon, loc.manualCep, km],
  );

  // Nova posição: refaz a busca atual (sempre em ação explícita; no GPS automático só se andou > 100 m)
  useEffect(() => {
    if (loc.source === "buscando" || !lastQuery.current) return;
    const prev = searchedAt.current;
    const moved = prev ? kmBetween(prev, loc) : Infinity;
    if (loc.force || moved > 0.1 || (prev?.cep || null) !== (loc.manualCep || null)) search(lastQuery.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.rev]);

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

  const nicheCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of stores) m.set(s.niche || "mercado", (m.get(s.niche || "mercado") || 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [stores]);
  const mapStores = useMemo(() => (nicheFilter ? stores.filter((s) => nicheFilter.includes(s.niche || "mercado")) : stores), [stores, nicheFilter]);

  const cheapest = results.length ? Math.min(...results.map((r) => r.best.price)) : null;
  const center = { lat: loc.lat, lon: loc.lon };
  // resultados de uma posição antiga não aparecem no mapa enquanto a nova busca roda
  const mapResults = data && kmBetween(data.center, loc) < 0.3 ? results : [];
  const onSelect = useCallback((id: string) => {
    setSelected(id);
    document.getElementById(`r-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col">
      <header className="sticky top-0 z-[1000] bg-brand px-4 pb-3 pt-4 text-white shadow">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold tracking-tight">📍 Preço Perto <span className="hidden text-sm font-normal text-white/80 sm:inline">o menor preço perto de você</span></h1>
          <span className="text-xs text-white/80">{data?.city ? `lojas em ${data.city}` : "o menor preço perto de você"}</span>
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
            placeholder="O que você procura? Ex.: arroz, dipirona, ração"
            className="min-w-0 flex-1 rounded-xl px-3 py-3 text-base text-gray-900 outline-none"
            enterKeyHint="search"
          />
          <button className="rounded-xl bg-orange-500 px-4 font-bold">Buscar</button>
        </form>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
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

      <LocationBar loc={loc} locating={locating} error={locError} follow={follow} onRefresh={() => refresh()} onFollow={setFollow} onManual={setManual} />

      <section className="relative h-[42vh] min-h-[260px] w-full">
        <MapView
          center={center}
          accuracy={loc.source === "gps" || loc.source === "salva" ? loc.accuracy ?? null : null}
          stores={mapStores}
          results={mapResults}
          selectedId={selected}
          onSelect={onSelect}
          onLocate={() => refresh()}
          locating={locating}
        />
      </section>

      {nicheCounts.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto bg-white px-3 py-2 text-xs shadow-sm">
          <button onClick={() => setNicheFilter(null)} className={`shrink-0 rounded-full border px-2.5 py-1 ${!nicheFilter ? "border-brand bg-brand text-white" : "border-gray-200"}`}>
            Todos ({stores.length})
          </button>
          {nicheCounts.map(([n, c]) => {
            const info = NICHE_INFO[n as Niche] || NICHE_INFO.outros;
            const on = !!nicheFilter && nicheFilter.includes(n);
            return (
              <button
                key={n}
                onClick={() => setNicheFilter(on && nicheFilter!.length === 1 ? null : on ? nicheFilter!.filter((x) => x !== n) : [...(nicheFilter || []), n])}
                className={`shrink-0 rounded-full border px-2.5 py-1 ${on ? "text-white" : "border-gray-200"}`}
                style={on ? { background: info.color, borderColor: info.color } : undefined}
              >
                {info.icon} {info.label} ({c})
              </button>
            );
          })}
        </div>
      )}

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
            <p className="mt-3 text-xs text-gray-500">{stores.length ? `${stores.length} lojas no mapa num raio de ${km} km.` : "Carregando lojas do mapa…"}</p>
          </div>
        )}

        {loading && <p className="p-4 text-center text-sm text-gray-600">Consultando as redes que atendem a sua região e os preços da comunidade…</p>}
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {data && !loading && (
          <>
            <div className="mb-2 rounded-xl bg-white p-3 text-sm shadow-sm">
              <p className="font-semibold">
                🔎 Consultamos {data.consultedCount} rede{data.consultedCount === 1 ? "" : "s"} de {(data.niches || []).map((n) => `${NICHE_INFO[n as Niche]?.icon || ""} ${NICHE_INFO[n as Niche]?.label.toLowerCase() || n}`).join(" e ")} para sua região
                {data.city || data.uf ? ` (${[data.city, data.uf].filter(Boolean).join("/")})` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-1 text-xs">
                {data.chains
                  .filter((c) => c.status !== "fora da área")
                  .map((c) => (
                    <span key={c.key} title={c.error || ""} className={`rounded-full px-2 py-0.5 ${c.status === "ok" ? "bg-green-100 text-green-800" : c.status === "erro" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                      {c.status === "ok" ? "✓" : c.status === "erro" ? "⚠" : "–"} {c.name}
                    </span>
                  ))}
                {!data.osm.ok && <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-yellow-800">lojas do mapa ainda carregando — busque de novo em instantes</span>}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {data.pricedCount} com preço para &quot;{data.query}&quot;
                {data.cep ? ` · CEP ${data.cep.replace(/(\d{5})(\d{3})/, "$1-$2")}` : ""}
                {data.widenedKm ? ` · ampliamos a busca de lojas para ${data.widenedKm} km` : ""}
              </p>
            </div>
            <p className="mb-3 text-sm text-gray-600">
              {results.length ? `${results.length} resultado(s)` : `Nenhum preço encontrado para "${data.query}" por perto.`}
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
                          {r.distanceKm != null ? `📍 ${dist(r.distanceKm)}${r.outsideRadius ? " (fora do raio)" : ""}` : "🌐 loja online · entrega no seu CEP"}
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
                      <p className="mt-2 rounded-lg bg-gray-50 p-2 text-[11px] leading-snug text-gray-500">ℹ️ {r.chain.priceScope}{r.chain.note ? ` ${r.chain.note}` : ""}</p>
                    )}
                  </li>
                );
              })}
            </ul>
            {data.unpriced?.length > 0 && (
              <div className="mt-5 rounded-2xl bg-white p-3 shadow-sm">
                <h3 className="mb-1 font-bold">Lojas por perto sem preço online</h3>
                <p className="mb-2 text-xs text-gray-500">Padarias, mercadinhos e lojas de bairro não têm preço na internet. Passou por lá? Registre o preço e ajude quem mora perto.</p>
                <ul className="divide-y">
                  {data.unpriced.map((u) => {
                    const info = NICHE_INFO[u.niche as Niche] || NICHE_INFO.outros;
                    return (
                      <li key={u.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                        <button className="min-w-0 text-left" onClick={() => setSelected(u.id)}>
                          <div className="truncate font-medium">{info.icon} {u.name}</div>
                          <div className="truncate text-xs text-gray-500">{dist(u.distanceKm)}{u.address ? ` · ${u.address}` : ""} · sem preço online</div>
                        </button>
                        <button onClick={() => { setFormStore(u.id); setShowForm(true); }} className="shrink-0 rounded-full border border-orange-300 px-3 py-1 text-xs font-semibold text-orange-700">
                          Registrar preço
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <p className="mt-6 text-center text-[11px] text-gray-400">
              Preços “site/online” vêm das lojas virtuais das redes que atendem o seu CEP e podem ser diferentes na loja física. Preços “comunidade” são enviados por usuários. Mapa © OpenStreetMap.
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
          initialStoreId={formStore}
          onClose={() => { setShowForm(false); setFormStore(null); }}
          onSaved={(p) => {
            setShowForm(false);
            setFormStore(null);
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
