import "server-only";
import { cacheLife } from "next/cache";
import type { BBox, PolygonGeometry } from "@/lib/geo";
import { asUpstreamError } from "../http";
import { opticalAcquisition, OPTICAL_WINDOW_DAYS, RADAR_WINDOW_DAYS, radarAcquisition, type Acquisition, type OpticalValues, type RadarValues } from "./district-analysis";
import { getZimbabweFires } from "./firms";
import { shiftDays } from "./layers";
import { itemClassHistogram, searchScenes } from "./planetary";
import { getDistrict } from "./zimbabwe";

/*
 * Chipinge Deforestation Observatory (Manicaland, Zimbabwe).
 *
 * Everything here is computed live from open data:
 *  • district outline — ZIMSTAT ADM2 (Chipinge rural district + Chipinge Urban);
 *  • land-cover composition 2017–2023 — Impact Observatory / Esri 10 m annual maps;
 *  • monitoring sites — Sentinel-2 indices and Sentinel-1 backscatter in a buffer around
 *    each site, this season vs. the same weeks one year earlier;
 *  • fires — NASA FIRMS VIIRS 375 m detections.
 */

export const CHIPINGE_DISTRICT_IDS = ["chipinge", "chipinge-urban"] as const;
/** Chipinge town (GeoNames 893549) — used for live weather and the prediction model. */
export const CHIPINGE_TOWN = { id: 893549, name: "Chipinge", lat: -20.18833, lng: 32.62365, population: 34959 };

export interface ChipingeSite {
  id: string;
  name: string;
  theme: string;
  /** Why the site is monitored (qualitative context, not a measurement). */
  context: string;
  lat: number;
  lng: number;
  radiusKm: number;
}

/** Monitoring sites of the Chipinge project (locations as defined in the v1 observatory). */
export const CHIPINGE_SITES: ChipingeSite[] = [
  {
    id: "chirinda",
    name: "Chirinda Forest Reserve",
    theme: "Rainforest integrity",
    context: "Mount Selinda. One of Africa's southernmost moist evergreen forests and home of the 'Big Tree', a giant red mahogany (Khaya anthotheca). Watched for edge clearing and fuelwood pressure.",
    lat: -20.4182,
    lng: 32.7025,
    radiusKm: 2.5,
  },
  {
    id: "macadamia",
    name: "Chipinge North highlands",
    theme: "Macadamia & coffee frontier",
    context: "Commercial macadamia, coffee and tea estates north of Chipinge town, where orchards have replaced natural woodland.",
    lat: -20.125,
    lng: 32.612,
    radiusKm: 3,
  },
  {
    id: "rusitu",
    name: "Rusitu valley",
    theme: "Cyclone Idai recovery",
    context: "Montane riparian corridor on the Chipinge–Chimanimani border, scarred by landslides and floods during Cyclone Idai (March 2019).",
    lat: -20.082,
    lng: 32.885,
    radiusKm: 3,
  },
  {
    id: "chisumbanje",
    name: "Chisumbanje & Save lowveld",
    theme: "Agro-industrial clearing",
    context: "Sugarcane estate and mopane woodland near the Save River, under pressure from irrigated agriculture and fuelwood.",
    lat: -20.812,
    lng: 32.268,
    radiusKm: 4,
  },
  {
    id: "jersey",
    name: "Jersey & Zona highlands",
    theme: "Plantation forestry",
    context: "Eastern highland plantations (pine, eucalyptus, tea) bordering indigenous forest patches.",
    lat: -20.355,
    lng: 32.754,
    radiusKm: 3,
  },
  {
    id: "musikavanhu",
    name: "Musikavanhu communal lands",
    theme: "Fuelwood & dry-season fires",
    context: "Communal miombo woodland with heavy domestic fuelwood demand and recurrent dry-season burning.",
    lat: -20.485,
    lng: 32.415,
    radiusKm: 4,
  },
  {
    id: "mutema",
    name: "Mutema & Tanganda",
    theme: "Riverine woodland",
    context: "Irrigated smallholder farming along the Tanganda River towards its confluence with the Save.",
    lat: -20.024,
    lng: 32.47,
    radiusKm: 3,
  },
];

export const getChipingeSite = (id: string) => CHIPINGE_SITES.find((s) => s.id === id) ?? null;

/** Combined outline of Chipinge rural district and Chipinge Urban. */
export function chipingeOutline(): { geometry: PolygonGeometry; bbox: BBox; areaKm2: number } {
  const parts = CHIPINGE_DISTRICT_IDS.map((id) => getDistrict(id)!).filter(Boolean);
  const polys = parts.flatMap((d) => (d.geometry.type === "Polygon" ? [d.geometry.coordinates] : d.geometry.coordinates));
  return {
    geometry: { type: "MultiPolygon", coordinates: polys },
    bbox: [Math.min(...parts.map((d) => d.bbox[0])), Math.min(...parts.map((d) => d.bbox[1])), Math.max(...parts.map((d) => d.bbox[2])), Math.max(...parts.map((d) => d.bbox[3]))],
    areaKm2: parts.reduce((s, d) => s + d.areaKm2, 0),
  };
}

/** Circle polygon (lng/lat) around a site. */
function circle(lat: number, lng: number, radiusKm: number, steps = 32): { geometry: PolygonGeometry; bbox: BBox } {
  const dLat = radiusKm / 110.57;
  const dLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([Math.round((lng + dLng * Math.cos(a)) * 1e5) / 1e5, Math.round((lat + dLat * Math.sin(a)) * 1e5) / 1e5]);
  }
  return { geometry: { type: "Polygon", coordinates: [ring] }, bbox: [lng - dLng, lat - dLat, lng + dLng, lat + dLat] };
}

const kmBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const x = (b.lng - a.lng) * 111.32 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const y = (b.lat - a.lat) * 110.57;
  return Math.hypot(x, y);
};

// ------------------------------------------------------------------ land cover

/** Impact Observatory / Esri 10 m annual land use–land cover classes. */
export const LULC_CLASSES: Record<number, { label: string; color: string }> = {
  2: { label: "Trees", color: "#397d49" },
  11: { label: "Rangeland", color: "#e3e2c3" },
  5: { label: "Crops", color: "#e49635" },
  7: { label: "Built area", color: "#c4281b" },
  8: { label: "Bare ground", color: "#a59b8f" },
  1: { label: "Water", color: "#419bdf" },
  4: { label: "Flooded vegetation", color: "#7a87c6" },
};

/** Display order (integer object keys would otherwise sort numerically). */
export const LULC_ORDER = [2, 11, 5, 7, 8, 1, 4].map((v) => LULC_CLASSES[v]);

export interface LandCoverYear {
  year: number;
  item: string;
  /** Share of classified pixels per class (0–1). */
  shares: Record<string, number>;
  /** Area per class, km² (share × official district area). */
  km2: Record<string, number>;
  cloudOrNoData: number;
}

export async function getChipingeLandCover(): Promise<{ years: LandCoverYear[]; areaKm2: number; source: string }> {
  "use cache";
  cacheLife("weeks");
  const outline = chipingeOutline();
  let items;
  try {
    items = await searchScenes({ collection: "io-lulc-annual-v02", intersects: outline.geometry, limit: 50 });
  } catch (err) {
    throw asUpstreamError(err, "Planetary Computer STAC");
  }
  // One map per year covers the whole district (UTM zone 36K).
  const byYear = new Map<number, string>();
  for (const it of items) {
    const y = Number(it.datetime.slice(0, 4)) || Number(it.id.slice(-4));
    if (!byYear.has(y)) byYear.set(y, it.id);
  }
  const years = await Promise.all(
    [...byYear].map(async ([year, item]): Promise<LandCoverYear | null> => {
      const hist = await itemClassHistogram("io-lulc-annual-v02", item, outline.geometry, "data").catch(() => null);
      if (!hist) return null;
      const classified = Object.entries(hist).filter(([v]) => LULC_CLASSES[Number(v)]);
      const total = classified.reduce((s, [, n]) => s + n, 0);
      const all = Object.values(hist).reduce((s, n) => s + n, 0);
      if (!total) return null;
      const shares: Record<string, number> = {};
      const km2: Record<string, number> = {};
      for (const [v, n] of classified) {
        const label = LULC_CLASSES[Number(v)].label;
        shares[label] = n / total;
        km2[label] = Math.round((n / total) * outline.areaKm2);
      }
      return { year, item, shares, km2, cloudOrNoData: Math.round(((all - total) / all) * 1000) / 1000 };
    }),
  );
  return {
    years: years.filter((y): y is LandCoverYear => y != null).sort((a, b) => a.year - b.year),
    areaKm2: outline.areaKm2,
    source: "Impact Observatory / Esri 10 m Annual Land Use Land Cover (io-lulc-annual-v02), CC BY 4.0",
  };
}

// ------------------------------------------------------------------ sites

export interface SiteIndicator {
  id: "ndvi" | "ndmi" | "bsi" | "vh";
  label: string;
  unit: string;
  current: number | null;
  baseline: number | null;
  delta: number | null;
  /** Direction of change that indicates canopy loss or degradation. */
  concern: "increase" | "decrease";
}

export interface SiteAnalysis {
  site: ChipingeSite;
  generatedAt: string;
  periods: { current: { start: string; end: string }; baseline: { start: string; end: string } };
  optical: { current: Acquisition<OpticalValues> | null; baseline: Acquisition<OpticalValues> | null };
  radar: { current: Acquisition<RadarValues> | null; baseline: Acquisition<RadarValues> | null };
  indicators: SiteIndicator[];
  fires24h: number;
  /** "loss" when vegetation dropped and bare soil rose year-on-year; "gain"; or "stable". */
  status: "loss" | "stable" | "gain" | "insufficient-data";
}

export async function analyzeSite(site: ChipingeSite, asOf: string): Promise<SiteAnalysis> {
  "use cache";
  cacheLife({ stale: 1800, revalidate: 21600, expire: 172800 });
  const area = circle(site.lat, site.lng, site.radiusKm);
  const opt = { end: asOf, start: shiftDays(asOf, -OPTICAL_WINDOW_DAYS) };
  const optBase = { end: shiftDays(opt.end, -365), start: shiftDays(opt.start, -365) };
  const sar = { end: asOf, start: shiftDays(asOf, -RADAR_WINDOW_DAYS) };
  const sarBase = { end: shiftDays(sar.end, -365), start: shiftDays(sar.start, -365) };

  let oc, ob, rc, rb, fires;
  try {
    [oc, ob, rc, rb, fires] = await Promise.all([
      opticalAcquisition(area, opt.start, opt.end),
      opticalAcquisition(area, optBase.start, optBase.end),
      radarAcquisition(area, sar.start, sar.end),
      radarAcquisition(area, sarBase.start, sarBase.end),
      getZimbabweFires().catch(() => null),
    ]);
  } catch (err) {
    throw asUpstreamError(err, "Satellite analysis");
  }
  const d = (a?: number, b?: number) => (a != null && b != null ? a - b : null);
  const indicators: SiteIndicator[] = [
    { id: "ndvi", label: "NDVI (vegetation)", unit: "", current: oc?.values.ndvi ?? null, baseline: ob?.values.ndvi ?? null, delta: d(oc?.values.ndvi, ob?.values.ndvi), concern: "decrease" },
    { id: "ndmi", label: "NDMI (canopy moisture)", unit: "", current: oc?.values.ndmi ?? null, baseline: ob?.values.ndmi ?? null, delta: d(oc?.values.ndmi, ob?.values.ndmi), concern: "decrease" },
    { id: "bsi", label: "BSI (bare soil)", unit: "", current: oc?.values.bsi ?? null, baseline: ob?.values.bsi ?? null, delta: d(oc?.values.bsi, ob?.values.bsi), concern: "increase" },
    { id: "vh", label: "Sentinel-1 VH backscatter", unit: "dB", current: rc?.values.vhDb ?? null, baseline: rb?.values.vhDb ?? null, delta: d(rc?.values.vhDb, rb?.values.vhDb), concern: "decrease" },
  ];
  const dN = indicators[0].delta;
  const dB = indicators[2].delta;
  // Loss: NDVI down ≥ 0.05 and BSI up ≥ 0.02 year-on-year (gain is the mirror image).
  const status: SiteAnalysis["status"] =
    dN == null || dB == null ? "insufficient-data" : dN <= -0.05 && dB >= 0.02 ? "loss" : dN >= 0.05 && dB <= -0.02 ? "gain" : "stable";

  return {
    site,
    generatedAt: new Date().toISOString(),
    periods: { current: opt, baseline: optBase },
    optical: { current: oc, baseline: ob },
    radar: { current: rc, baseline: rb },
    indicators,
    fires24h: fires ? fires.last24h.filter((f) => kmBetween(site, f) <= site.radiusKm).length : 0,
    status,
  };
}
