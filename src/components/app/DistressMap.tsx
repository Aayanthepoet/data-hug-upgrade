import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { STATE_CENTERS } from "@/lib/distress/counties";

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  distressType: string;
  estimatedValue: number | null;
  equity: number | null;
  listPrice: number | null;
  daysOnMarket: number | null;
  leadScore: number;
};

const COLOR_BY_TYPE: Record<string, string> = {
  reo: "#ef4444",
  preforeclosure: "#f97316",
  auction: "#eab308",
  tax_lien: "#a855f7",
  tax_delinquent: "#8b5cf6",
  fsbo_stale: "#06b6d4",
  vacant: "#22c55e",
  absentee: "#64748b",
};

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

function popupHtml(p: MapPin, color: string) {
  const list = p.listPrice
    ? `<div style="font-size:11px;color:#374151">List $${p.listPrice.toLocaleString()} · ${p.daysOnMarket ?? 0}d on market</div>`
    : "";
  return `
    <div style="font-size:12px;line-height:1.4">
      <div style="font-weight:600">${escapeHtml(p.address)}</div>
      <div style="font-size:11px;color:#4b5563">${escapeHtml(p.city ?? "")}, ${escapeHtml(p.state ?? "")} ${escapeHtml(p.zip ?? "")} · ${escapeHtml(p.county ?? "")}</div>
      <div style="font-size:11px;margin-top:2px">
        <span style="display:inline-block;padding:1px 6px;border-radius:3px;color:#fff;background:${color}">
          ${escapeHtml(p.distressType.replace("_", " "))}
        </span>
        <span style="margin-left:6px">Score ${p.leadScore}</span>
      </div>
      <div style="font-size:11px;color:#374151">
        Value $${p.estimatedValue?.toLocaleString() ?? "—"} · Equity $${p.equity?.toLocaleString() ?? "—"}
      </div>
      ${list}
    </div>`;
}

function ClusterLayer({ pins }: { pins: MapPin[] }) {
  const map = useMap();
  const groupRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    const group = (L as any).markerClusterGroup({
      chunkedLoading: true,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 55,
      iconCreateFunction: (cluster: L.MarkerCluster) => {
        const count = cluster.getChildCount();
        const size = count < 10 ? 32 : count < 50 ? 38 : count < 200 ? 46 : 54;
        const bg =
          count < 10 ? "#06b6d4" : count < 50 ? "#a855f7" : count < 200 ? "#f97316" : "#ef4444";
        return L.divIcon({
          html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:12px;border:2px solid rgba(255,255,255,0.85);box-shadow:0 0 0 4px ${bg}33">${count}</div>`,
          className: "distress-cluster-icon",
          iconSize: L.point(size, size),
        });
      },
    }) as L.MarkerClusterGroup;
    groupRef.current = group;
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
      groupRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.clearLayers();
    if (!pins.length) return;
    const markers: L.CircleMarker[] = [];
    for (const p of pins) {
      const color = COLOR_BY_TYPE[p.distressType] ?? "#06b6d4";
      const radius = 6 + Math.min(8, Math.round(p.leadScore / 12));
      const m = L.circleMarker([p.lat, p.lng], {
        radius,
        color,
        fillColor: color,
        fillOpacity: 0.75,
        weight: 1.5,
      });
      m.bindPopup(popupHtml(p, color));
      markers.push(m);
    }
    group.addLayers(markers);
    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [pins, map]);

  return null;
}

export function DistressMap({
  pins,
  state,
  height = 520,
}: {
  pins: MapPin[];
  state: string;
  height?: number;
}) {
  const center = useMemo(
    () => STATE_CENTERS[state] ?? { lat: 39.5, lng: -98.35, zoom: 4 },
    [state],
  );
  const placeable = pins.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  return (
    <div
      className="relative rounded-lg overflow-hidden border border-border"
      style={{ height }}
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={center.zoom}
        scrollWheelZoom
        style={{ height: "100%", width: "100%", background: "#0a0a0a" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <ClusterLayer pins={placeable} />
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[400] bg-black/80 border border-border rounded-md px-3 py-2 text-xs space-y-1 backdrop-blur">
        <div className="font-semibold mb-1">Distress type</div>
        {Object.entries(COLOR_BY_TYPE).map(([k, c]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} />
            <span className="capitalize">{k.replace("_", " ")}</span>
          </div>
        ))}
      </div>

      {placeable.length === 0 && (
        <div className="absolute inset-0 grid place-items-center text-sm text-[var(--w55)] pointer-events-none">
          No mappable results — try a featured market (NY / NJ / CT / PA).
        </div>
      )}
    </div>
  );
}
