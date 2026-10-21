"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { MapContainer, Pane, TileLayer, useMap, useMapEvents, ZoomControl } from "react-leaflet";
import { BASEMAPS, type BasemapId } from "@/components/maps/basemaps";
import { FlyTo } from "@/components/maps/fly-to";

export interface EoTileSource {
  url: string;
  maxNativeZoom: number;
  minZoom: number;
  attribution: string;
}

export interface MapView {
  bbox: [number, number, number, number];
  zoom: number;
}

/** Clips the "before" pane to the left of the swipe divider, following map pans and zooms. */
function SwipeClip({ pane, ratio }: { pane: string; ratio: number }) {
  const map = useMap();
  useEffect(() => {
    const el = map.getPane(pane);
    if (!el) return;
    const update = () => {
      const size = map.getSize();
      const nw = map.containerPointToLayerPoint([0, 0]);
      const se = map.containerPointToLayerPoint(size);
      el.style.clip = `rect(${nw.y}px, ${nw.x + size.x * ratio}px, ${se.y}px, ${nw.x}px)`;
    };
    update();
    map.on("move zoom resize", update);
    return () => {
      map.off("move zoom resize", update);
      el.style.clip = "";
    };
  }, [map, pane, ratio]);
  return null;
}

function ViewReporter({ onView }: { onView: (v: MapView) => void }) {
  const map = useMapEvents({
    moveend: () => report(),
  });
  const report = () => {
    const b = map.getBounds();
    onView({ bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], zoom: map.getZoom() });
  };
  useEffect(report, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function EoTiles({ source, opacity, pane }: { source: EoTileSource; opacity: number; pane?: string }) {
  return (
    <TileLayer
      key={source.url}
      url={source.url}
      opacity={opacity}
      minZoom={source.minZoom}
      maxNativeZoom={source.maxNativeZoom}
      maxZoom={19}
      attribution={source.attribution}
      pane={pane}
      zIndex={pane ? undefined : 300}
    />
  );
}

export default function EoMapCanvas({
  basemap,
  target,
  after,
  before,
  ratio,
  opacity,
  onView,
}: {
  basemap: BasemapId;
  target: { lat: number; lng: number; zoom: number };
  after: EoTileSource | null;
  before: EoTileSource | null;
  ratio: number;
  opacity: number;
  onView: (v: MapView) => void;
}) {
  return (
    <MapContainer center={[target.lat, target.lng]} zoom={target.zoom} zoomControl={false} fadeAnimation={false} worldCopyJump className="size-full">
      <ZoomControl position="bottomright" />
      {BASEMAPS[basemap].layers.map((l) => (
        <TileLayer key={`${basemap}-${l.url}`} url={l.url} attribution={l.attribution} maxZoom={19} />
      ))}
      <Pane name="eo-after" style={{ zIndex: 300 }}>
        {after && <EoTiles source={after} opacity={opacity} pane="eo-after" />}
      </Pane>
      <Pane name="eo-before" style={{ zIndex: 310 }}>
        {before && <EoTiles source={before} opacity={opacity} pane="eo-before" />}
      </Pane>
      {before && <SwipeClip pane="eo-before" ratio={ratio} />}
      <FlyTo lat={target.lat} lng={target.lng} zoom={target.zoom} />
      <ViewReporter onView={onView} />
    </MapContainer>
  );
}
