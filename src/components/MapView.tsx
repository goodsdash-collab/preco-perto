"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import type { ResultItem, StoreLite } from "./types";
import { brl, dist } from "./format";
import { NICHE_INFO, type Niche } from "@/lib/categories";

type Props = {
  center: { lat: number; lon: number };
  stores: StoreLite[];
  results: ResultItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  accuracy?: number | null;
  onLocate?: () => void;
  locating?: boolean;
};

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export default function MapView({ center, stores, results, selectedId, onSelect, accuracy, onLocate, locating }: Props) {
  const locateBtn = useRef<HTMLAnchorElement | null>(null);
  const onLocateRef = useRef(onLocate);
  onLocateRef.current = onLocate;
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const markers = useRef<Map<string, L.Marker | L.CircleMarker>>(new Map());

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: true, attributionControl: true }).setView([center.lat, center.lon], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    // Controle "me localize" (abaixo do zoom)
    const Locate = L.Control.extend({
      onAdd() {
        const div = L.DomUtil.create("div", "leaflet-bar leaflet-control");
        const a = L.DomUtil.create("a", "pp-locate", div) as HTMLAnchorElement;
        a.href = "#";
        a.title = "Atualizar minha localização";
        a.setAttribute("role", "button");
        a.setAttribute("aria-label", "Atualizar minha localização");
        a.setAttribute("data-testid", "map-locate");
        a.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="#1c7ed6"/><circle cx="12" cy="12" r="8" fill="none" stroke="#333" stroke-width="2"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4" stroke="#333" stroke-width="2"/></svg>';
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.on(a, "click", (e) => {
          L.DomEvent.preventDefault(e);
          onLocateRef.current?.();
        });
        locateBtn.current = a;
        return div;
      },
    });
    new Locate({ position: "topleft" }).addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    const lg = layer.current;
    if (!m || !lg) return;
    lg.clearLayers();
    markers.current.clear();

    if (accuracy && accuracy > 15 && accuracy < 5000) {
      L.circle([center.lat, center.lon], { radius: accuracy, color: "#1c7ed6", weight: 1, fillColor: "#1c7ed6", fillOpacity: 0.1, interactive: false }).addTo(lg);
    }
    L.circleMarker([center.lat, center.lon], { radius: 8, color: "#fff", weight: 3, fillColor: "#1c7ed6", fillOpacity: 1 })
      .bindPopup("Você está aqui")
      .addTo(lg);

    const withPrice = new Set(results.filter((r) => r.store).map((r) => r.store!.id));
    for (const s of stores) {
      if (withPrice.has(s.id)) continue;
      const info = NICHE_INFO[(s.niche as Niche) || "mercado"] || NICHE_INFO.outros;
      const cm = L.circleMarker([s.lat, s.lon], { radius: 5, color: "#fff", weight: 1, fillColor: info.color, fillOpacity: 0.75 })
        .bindPopup(`${info.icon} <b>${esc(s.name)}</b><br/>${dist(s.distanceKm)}<br/><small>Sem preço online para essa busca</small>`)
        .addTo(lg);
      markers.current.set(s.id, cm);
    }

    const bestPrice = results.length ? Math.min(...results.map((r) => r.best.price)) : 0;
    const pts: L.LatLngExpression[] = [[center.lat, center.lon]];
    for (const r of results) {
      if (!r.store) continue;
      const cls = r.best.price === bestPrice ? "best" : r.best.source === "comunidade" ? "comunidade" : "";
      const icon = L.divIcon({ className: "", html: `<span class="price-pin ${cls}">${brl(r.best.price)}</span>`, iconSize: [0, 0] });
      const mk = L.marker([r.store.lat, r.store.lon], { icon, zIndexOffset: r.best.price === bestPrice ? 1000 : 500 })
        .bindPopup(`<b>${esc(r.store.name)}</b><br/>${esc(r.best.product)}<br/><b>${brl(r.best.price)}</b> · ${dist(r.distanceKm)}`)
        .on("click", () => onSelect(r.id))
        .addTo(lg);
      markers.current.set(r.id, mk);
      pts.push([r.store.lat, r.store.lon]);
    }
    if (pts.length > 1) m.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 15 });
    else m.setView([center.lat, center.lon], 14);
  }, [center.lat, center.lon, accuracy, stores, results, onSelect]);

  useEffect(() => {
    locateBtn.current?.classList.toggle("pp-locating", !!locating);
  }, [locating]);

  useEffect(() => {
    if (!selectedId || !map.current) return;
    const mk = markers.current.get(selectedId);
    if (mk) {
      map.current.setView(mk.getLatLng(), Math.max(map.current.getZoom(), 15));
      mk.openPopup();
    }
  }, [selectedId]);

  return <div ref={el} className="h-full w-full" />;
}
