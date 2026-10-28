import type { LatLngBoundsExpression, LatLngExpression, Map as LeafletMap } from "leaflet";

/**
 * Leaflet throws ("Invalid LatLng object: (NaN, NaN)") when it animates a map whose
 * container has no size yet — e.g. while a phone is still laying the page out. These
 * helpers animate only a visible map, jump otherwise, and never let a failed move take
 * down the page.
 */
function ready(map: LeafletMap) {
  map.stop();
  map.invalidateSize({ pan: false });
  const s = map.getSize();
  return s.x > 0 && s.y > 0;
}

export function moveTo(map: LeafletMap, center: LatLngExpression, zoom: number, duration: number) {
  try {
    if (ready(map)) map.flyTo(center, zoom, { duration });
    else map.setView(center, zoom, { animate: false });
  } catch {
    try {
      map.setView(center, zoom, { animate: false });
    } catch {
      /* map not ready; the next change moves it */
    }
  }
}

export function moveToBounds(map: LeafletMap, bounds: LatLngBoundsExpression, options: { padding?: [number, number]; maxZoom?: number; duration: number }) {
  const { duration, ...fit } = options;
  try {
    if (ready(map)) map.flyToBounds(bounds, { ...fit, duration });
    else map.fitBounds(bounds, { ...fit, animate: false });
  } catch {
    try {
      map.fitBounds(bounds, { ...fit, animate: false });
    } catch {
      /* map not ready; the next change moves it */
    }
  }
}
