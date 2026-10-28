"use client";

import "leaflet/dist/leaflet.css";
import type L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { CircleMarker, GeoJSON, MapContainer, Pane, Popup, TileLayer, useMap, ZoomControl } from "react-leaflet";
import type { DistrictShapes, FirePoints, SitePoints } from "@/lib/client/api";
import { BASEMAPS, type BasemapId } from "@/components/maps/basemaps";
import { moveToBounds } from "@/components/maps/safe-move";
import type { EoTileSource } from "@/components/eo/eo-map-canvas";

const ZIMBABWE_BOUNDS: L.LatLngBoundsExpression = [
  [-22.42, 25.24],
  [-15.6, 33.07],
];

const SITE_COLOR: Record<string, string> = { quarry: "#94a3c0", mine: "#fbbf24", shaft: "#f43f5e", adit: "#f43f5e" };
const fireColor = (frp: number) => (frp >= 20 ? "#f43f5e" : frp >= 5 ? "#fb923c" : "#fbbf24");

/** Flies to the selected district, or back to the national extent. */
function FitSelection({ bbox }: { bbox: [number, number, number, number] | null }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (first.current && !bbox) {
      first.current = false;
      return;
    }
    first.current = false;
    if (bbox) moveToBounds(map, [[bbox[1], bbox[0]], [bbox[3], bbox[2]]], { padding: [30, 30], duration: 1.1, maxZoom: 11 });
    else moveToBounds(map, ZIMBABWE_BOUNDS, { duration: 1.1 });
  }, [map, bbox]);
  return null;
}

export default function ZwMapCanvas({
  basemap,
  shapes,
  colorOf,
  selected,
  onSelect,
  fires,
  sites,
  underlay,
}: {
  basemap: BasemapId;
  shapes: DistrictShapes | undefined;
  /** Choropleth fill per district id (null = no fill). */
  colorOf: (id: string) => string | null;
  selected: { id: string; bbox: [number, number, number, number] } | null;
  onSelect: (id: string) => void;
  fires: FirePoints | undefined;
  sites: SitePoints | undefined;
  underlay: EoTileSource | null;
}) {
  const geoRef = useRef<L.GeoJSON | null>(null);
  const selectedId = selected?.id ?? null;

  const style = useMemo(
    () =>
      (feature?: GeoJSON.Feature): L.PathOptions => {
        const id = String(feature?.properties?.id);
        const fill = colorOf(id);
        const isSel = id === selectedId;
        return {
          color: isSel ? "#22d3ee" : "rgba(231,236,246,0.55)",
          weight: isSel ? 3 : 0.8,
          fillColor: fill ?? "#000",
          fillOpacity: underlay ? (isSel ? 0 : 0.08) : fill ? (isSel ? 0.75 : 0.55) : 0,
        };
      },
    [colorOf, selectedId, underlay],
  );

  // Restyle in place: re-creating the GeoJSON layer for every change would be slow.
  useEffect(() => {
    geoRef.current?.setStyle(style as L.StyleFunction);
  }, [style]);

  return (
    <MapContainer bounds={ZIMBABWE_BOUNDS} zoomControl={false} fadeAnimation={false} preferCanvas className="size-full">
      <ZoomControl position="bottomright" />
      {BASEMAPS[basemap].layers.map((l) => (
        <TileLayer key={`${basemap}-${l.url}`} url={l.url} attribution={l.attribution} maxZoom={19} />
      ))}
      {underlay && (
        <TileLayer
          key={underlay.url}
          url={underlay.url}
          minZoom={underlay.minZoom}
          maxNativeZoom={underlay.maxNativeZoom}
          maxZoom={19}
          attribution={underlay.attribution}
          zIndex={300}
        />
      )}

      {shapes && (
        <GeoJSON
          ref={geoRef}
          data={shapes as unknown as GeoJSON.FeatureCollection}
          style={style}
          onEachFeature={(feature, layer) => {
            const p = feature.properties as { id: string; name: string };
            layer.bindTooltip(p.name, { sticky: true, className: "district-tip" });
            layer.on("click", () => onSelect(p.id));
          }}
        />
      )}

      <Pane name="points" style={{ zIndex: 650 }}>
        {sites?.features.map((s) => (
          <CircleMarker
            key={s.id ?? s.properties.id}
            pane="points"
            center={[s.geometry.coordinates[1], s.geometry.coordinates[0]]}
            radius={s.properties.kind === "quarry" ? 4 : 5.5}
            pathOptions={{ color: "#0b1120", weight: 1.5, fillColor: SITE_COLOR[s.properties.kind], fillOpacity: 1 }}
          >
            <Popup>
              <div className="font-semibold">{s.properties.name ?? "Unnamed site"}</div>
              <div className="text-[11px] capitalize text-muted">
                {s.properties.kind}
                {s.properties.resource ? ` · ${s.properties.resource}` : ""}
              </div>
              <div className="mt-1 text-[10px] text-subtle">Mapped in OpenStreetMap ({s.properties.id})</div>
            </Popup>
          </CircleMarker>
        ))}
        {fires?.features.map((f, i) => (
          <CircleMarker
            key={i}
            pane="points"
            center={[f.geometry.coordinates[1], f.geometry.coordinates[0]]}
            radius={f.properties.frp >= 20 ? 4 : 2.5}
            pathOptions={{ stroke: false, fillColor: fireColor(f.properties.frp), fillOpacity: 0.85 }}
          >
            <Popup>
              <div className="font-semibold">VIIRS fire detection</div>
              <div className="text-[11px] text-muted">
                {new Date(f.properties.acquired).toLocaleString("en-GB", { timeZone: "UTC" })} UTC · {f.properties.night ? "night" : "day"}
              </div>
              <div className="mt-1 text-[11px]">
                FRP {f.properties.frp} MW · {f.properties.confidence} confidence
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </Pane>

      <FitSelection bbox={selected?.bbox ?? null} />
    </MapContainer>
  );
}
