"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { Circle, CircleMarker, GeoJSON, MapContainer, Marker, Pane, Popup, TileLayer, Tooltip, useMap, ZoomControl } from "react-leaflet";
import type { ChipingeOverview } from "@/lib/client/api";
import type { SiteAnalysis } from "@/lib/server/eo/chipinge";
import { BASEMAPS, type BasemapId } from "@/components/maps/basemaps";
import type { EoTileSource } from "@/components/eo/eo-map-canvas";
import { SITE_STATUS } from "./site-status";


function FitView({ bbox, focus }: { bbox: [number, number, number, number]; focus: { lat: number; lng: number; radiusKm: number } | null }) {
  const map = useMap();
  useEffect(() => {
    map.stop();
    if (focus) {
      const d = (focus.radiusKm * 2.2) / 111;
      map.flyToBounds(
        [
          [focus.lat - d, focus.lng - d],
          [focus.lat + d, focus.lng + d],
        ],
        { duration: 1, maxZoom: 13 },
      );
    } else {
      map.flyToBounds(
        [
          [bbox[1], bbox[0]],
          [bbox[3], bbox[2]],
        ],
        { padding: [20, 20], duration: 1 },
      );
    }
  }, [map, bbox, focus]);
  return null;
}

const pin = (color: string, active: boolean) =>
  L.divIcon({
    className: "",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<span style="display:block;width:22px;height:22px;border-radius:9999px;background:${color};border:3px solid ${active ? "#22d3ee" : "#0b1120"};box-shadow:0 0 0 2px ${color}66"></span>`,
  });

export default function ChipingeMapCanvas({
  data,
  analyses,
  selected,
  onSelect,
  basemap,
  underlay,
}: {
  data: ChipingeOverview;
  analyses: Record<string, SiteAnalysis | null> | undefined;
  selected: string | null;
  onSelect: (id: string | null) => void;
  basemap: BasemapId;
  underlay: EoTileSource | null;
}) {
  const focus = data.sites.find((s) => s.id === selected) ?? null;
  return (
    <MapContainer
      bounds={[
        [data.bbox[1], data.bbox[0]],
        [data.bbox[3], data.bbox[2]],
      ]}
      zoomControl={false}
      fadeAnimation={false}
      scrollWheelZoom={false}
      preferCanvas
      className="size-full"
    >
      <ZoomControl position="bottomright" />
      {BASEMAPS[basemap].layers.map((l) => (
        <TileLayer key={`${basemap}-${l.url}`} url={l.url} attribution={l.attribution} maxZoom={19} />
      ))}
      {underlay && <TileLayer key={underlay.url} url={underlay.url} minZoom={underlay.minZoom} maxNativeZoom={underlay.maxNativeZoom} maxZoom={19} attribution={underlay.attribution} zIndex={300} />}
      <GeoJSON data={data.outline as unknown as GeoJSON.Feature} style={{ color: "#34d399", weight: 2.5, dashArray: "6 4", fillOpacity: underlay ? 0 : 0.04, fillColor: "#34d399" }} />

      <Pane name="sites" style={{ zIndex: 640 }}>
        {data.sites.map((s) => {
          const st = SITE_STATUS[analyses?.[s.id]?.status ?? "insufficient-data"];
          return (
            <Circle
              key={`${s.id}-buffer`}
              pane="sites"
              center={[s.lat, s.lng]}
              radius={s.radiusKm * 1000}
              pathOptions={{ color: st.color, weight: s.id === selected ? 3 : 1.5, fillOpacity: s.id === selected ? 0.12 : 0.06 }}
              eventHandlers={{ click: () => onSelect(s.id) }}
            />
          );
        })}
      </Pane>
      {data.sites.map((s) => {
        const st = SITE_STATUS[analyses?.[s.id]?.status ?? "insufficient-data"];
        return (
          <Marker key={s.id} position={[s.lat, s.lng]} icon={pin(st.color, s.id === selected)} eventHandlers={{ click: () => onSelect(s.id) }} zIndexOffset={1000}>
            <Tooltip direction="top" offset={[0, -10]} className="district-tip">
              {s.name}
            </Tooltip>
          </Marker>
        );
      })}

      <Pane name="fires" style={{ zIndex: 650 }}>
        {data.fires?.last24h.map((f, i) => (
          <CircleMarker key={i} pane="fires" center={[f.lat, f.lng]} radius={f.frp >= 20 ? 5 : 3.5} pathOptions={{ color: "#0b1120", weight: 1, fillColor: f.frp >= 20 ? "#f43f5e" : "#fb923c", fillOpacity: 0.95 }}>
            <Popup>
              <div className="font-semibold">VIIRS active fire</div>
              <div className="text-[11px] text-muted">
                {new Date(f.acquired).toLocaleString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} UTC · {f.night ? "night" : "day"}
              </div>
              <div className="mt-1 text-[11px]">Fire radiative power {f.frp} MW</div>
            </Popup>
          </CircleMarker>
        ))}
      </Pane>

      <FitView bbox={data.bbox} focus={focus} />
    </MapContainer>
  );
}
