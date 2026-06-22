import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
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

function FitBounds({ pins }: { pins: MapPin[] }) {
  const map = useMap();
  useEffect(() => {
    if (!pins.length) return;
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
        {placeable.map((p) => {
          const color = COLOR_BY_TYPE[p.distressType] ?? "#06b6d4";
          const radius = 6 + Math.min(8, Math.round(p.leadScore / 12));
          return (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lng]}
              radius={radius}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.7,
                weight: 1.5,
              }}
            >
              <Popup>
                <div className="text-sm space-y-1">
                  <div className="font-semibold">{p.address}</div>
                  <div className="text-xs text-gray-600">
                    {p.city}, {p.state} {p.zip} · {p.county}
                  </div>
                  <div className="text-xs">
                    <span
                      className="inline-block px-1.5 py-0.5 rounded text-white"
                      style={{ background: color }}
                    >
                      {p.distressType.replace("_", " ")}
                    </span>
                    <span className="ml-2">Score {p.leadScore}</span>
                  </div>
                  <div className="text-xs text-gray-700">
                    Value ${p.estimatedValue?.toLocaleString() ?? "—"} ·
                    Equity ${p.equity?.toLocaleString() ?? "—"}
                  </div>
                  {p.listPrice && (
                    <div className="text-xs text-gray-700">
                      List ${p.listPrice.toLocaleString()} · {p.daysOnMarket ?? 0}d on market
                    </div>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
        <FitBounds pins={placeable} />
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
