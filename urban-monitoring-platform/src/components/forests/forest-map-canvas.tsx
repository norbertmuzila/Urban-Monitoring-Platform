"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, GeoJSON, MapContainer, Pane, Popup, TileLayer, useMap, ZoomControl } from "react-leaflet";
import type { CountryFires, CountryShape } from "@/lib/client/api";
import { BASEMAPS } from "@/components/maps/basemaps";
import { moveToBounds } from "@/components/maps/safe-move";
import type { EoTileSource } from "@/components/eo/eo-map-canvas";

function FitCountry({ bbox }: { bbox: [number, number, number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!bbox) return;
    moveToBounds(map, [[bbox[1], bbox[0]], [bbox[3], bbox[2]]], { padding: [20, 20], duration: 1, maxZoom: 9 });
  }, [map, bbox]);
  return null;
}

const fireColor = (frp: number) => (frp >= 20 ? "#f43f5e" : frp >= 5 ? "#fb923c" : "#fbbf24");

export default function ForestMapCanvas({ shape, fires, underlay }: { shape: CountryShape | undefined; fires: CountryFires | undefined; underlay: EoTileSource | null }) {
  return (
    <MapContainer center={[0, 20]} zoom={3} zoomControl={false} fadeAnimation={false} preferCanvas scrollWheelZoom={false} worldCopyJump className="size-full">
      <ZoomControl position="bottomright" />
      {BASEMAPS.dark.layers.map((l) => (
        <TileLayer key={l.url} url={l.url} attribution={l.attribution} maxZoom={19} />
      ))}
      {underlay && <TileLayer key={underlay.url} url={underlay.url} minZoom={underlay.minZoom} maxNativeZoom={underlay.maxNativeZoom} maxZoom={19} attribution={underlay.attribution} opacity={0.85} zIndex={300} />}
      {shape?.geometry && (
        <GeoJSON key={shape.properties.iso2} data={shape as unknown as GeoJSON.Feature} style={{ color: "#34d399", weight: 2, fillOpacity: underlay ? 0 : 0.06, fillColor: "#34d399" }} />
      )}
      <Pane name="fires" style={{ zIndex: 650 }}>
        {fires?.features.map((f, i) => (
          <CircleMarker
            key={i}
            pane="fires"
            center={[f.geometry.coordinates[1], f.geometry.coordinates[0]]}
            radius={f.properties.frp >= 20 ? 4 : 2.5}
            pathOptions={{ stroke: false, fillColor: fireColor(f.properties.frp), fillOpacity: 0.85 }}
          >
            <Popup>
              <div className="font-semibold">VIIRS active fire</div>
              <div className="text-[11px] text-muted">
                {new Date(f.properties.acquired).toLocaleString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} UTC · {f.properties.night ? "night" : "day"}
              </div>
              <div className="mt-1 text-[11px]">Fire radiative power {f.properties.frp} MW</div>
            </Popup>
          </CircleMarker>
        ))}
      </Pane>
      <FitCountry bbox={shape?.bbox ?? null} />
    </MapContainer>
  );
}
