"use client";

import { useMemo, useState } from "react";
import type { StoreLite } from "./types";
import { dist } from "./format";

async function compress(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const max = 1280;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.75));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function today() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export default function PriceForm({ stores, initialProduct, onClose, onSaved }: { stores: StoreLite[]; initialProduct: string; onClose: () => void; onSaved: (product: string) => void }) {
  const [product, setProduct] = useState(initialProduct);
  const [price, setPrice] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [storeId, setStoreId] = useState("");
  const [date, setDate] = useState(today());
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const list = useMemo(() => {
    const f = storeFilter.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return stores
      .filter((s) => !f || s.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(f))
      .slice(0, 80);
  }, [stores, storeFilter]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    if (!storeId) return setErr("Escolha o mercado.");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("product", product);
      fd.set("price", price);
      fd.set("storeId", storeId);
      fd.set("date", date);
      fd.set("website", (e.currentTarget.elements.namedItem("website") as HTMLInputElement)?.value || "");
      if (photo) fd.set("photo", await compress(photo), "foto.jpg");
      const r = await fetch("/api/prices", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Erro ao salvar.");
      onSaved(product);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Registrar preço</h2>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1 text-2xl leading-none text-gray-500" aria-label="Fechar">×</button>
        </div>
        <p className="mb-4 text-sm text-gray-600">Viu um preço no mercado? Compartilhe com quem mora perto.</p>

        <label className="mb-1 block text-sm font-semibold">Produto</label>
        <input required value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Ex.: Arroz Tio João 5kg" className="mb-3 w-full rounded-xl border px-3 py-3 text-base" maxLength={120} />

        <label className="mb-1 block text-sm font-semibold">Preço (R$)</label>
        <input required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9,.]/g, ""))} placeholder="Ex.: 22,90" className="mb-3 w-full rounded-xl border px-3 py-3 text-base" />

        <label className="mb-1 block text-sm font-semibold">Mercado</label>
        <input value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)} placeholder="Filtrar por nome…" className="mb-2 w-full rounded-xl border px-3 py-2 text-sm" />
        <select required value={storeId} onChange={(e) => setStoreId(e.target.value)} className="mb-3 w-full rounded-xl border bg-white px-3 py-3 text-base" size={1}>
          <option value="">{stores.length ? "Escolha o mercado" : "Carregando mercados próximos…"}</option>
          {list.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {dist(s.distanceKm)}{s.address ? ` · ${s.address}` : ""}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-sm font-semibold">Data</label>
        <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className="mb-3 w-full rounded-xl border px-3 py-3 text-base" />

        <label className="mb-1 block text-sm font-semibold">Foto da etiqueta ou do cupom (opcional)</label>
        <input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] || null)} className="mb-4 block w-full text-sm" />

        <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

        {err && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-brand py-3 text-base font-bold text-white disabled:opacity-60">{busy ? "Salvando…" : "Salvar preço"}</button>
      </form>
    </div>
  );
}
