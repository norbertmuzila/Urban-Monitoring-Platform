// Minimal planar geometry helpers for GeoJSON polygons (lon/lat degrees).

export type Position = [number, number];
export type PolygonGeometry = { type: "Polygon"; coordinates: Position[][] } | { type: "MultiPolygon"; coordinates: Position[][][] };
export type BBox = [number, number, number, number];

export const polygonsOf = (g: PolygonGeometry): Position[][][] => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);

function inRing(x: number, y: number, ring: Position[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInGeometry(lng: number, lat: number, g: PolygonGeometry) {
  return polygonsOf(g).some((poly) => inRing(lng, lat, poly[0]) && !poly.slice(1).some((hole) => inRing(lng, lat, hole)));
}

export const inBBox = (lng: number, lat: number, b: BBox) => lng >= b[0] && lng <= b[2] && lat >= b[1] && lat <= b[3];

export function unionBBox(boxes: BBox[]): BBox {
  return [
    Math.min(...boxes.map((b) => b[0])),
    Math.min(...boxes.map((b) => b[1])),
    Math.max(...boxes.map((b) => b[2])),
    Math.max(...boxes.map((b) => b[3])),
  ];
}
