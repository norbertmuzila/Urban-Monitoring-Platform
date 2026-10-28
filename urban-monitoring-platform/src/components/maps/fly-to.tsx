"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { moveTo } from "./safe-move";

/**
 * Animates the map to a target when it changes. Skips no-op flights (e.g. on mount,
 * where MapContainer is already at the target) and stops any flight in progress first —
 * an interrupted flyTo otherwise leaves Leaflet's tile panes stuck mid-zoom.
 */
export function FlyTo({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    const here = map.getCenter();
    if (map.getZoom() === zoom && Math.abs(here.lat - lat) < 1e-6 && Math.abs(here.lng - lng) < 1e-6) return;
    moveTo(map, [lat, lng], zoom, 1.2);
  }, [map, lat, lng, zoom]);
  return null;
}
