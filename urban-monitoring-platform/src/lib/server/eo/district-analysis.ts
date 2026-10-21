import "server-only";
import { cacheLife } from "next/cache";
import { S2_INDEX } from "@/lib/eo/layers";
import { asUpstreamError } from "../http";
import { getZimbabweFires } from "./firms";
import { shiftDays } from "./layers";
import { itemStatistics, searchScenes, type Scene } from "./planetary";
import { sitesInDistrict, type District, type MiningSite } from "./zimbabwe";

/*
 * District land-disturbance screening.
 *
 * Compares this season with the same season one year earlier (removing the strong
 * Zimbabwean wet/dry seasonality) using real zonal statistics from Sentinel-2 L2A
 * and Sentinel-1 RTC, then blends the changes with VIIRS fire activity.
 *
 * It is a SCREENING indicator for prioritising field checks. Without a mining
 * cadastre it cannot determine whether any activity is licensed.
 */

export const OPTICAL_WINDOW_DAYS = 45;
export const RADAR_WINDOW_DAYS = 30;
const OPTICAL_MAX_CLOUD = 15;
const MAX_TILES = 8;

const OPTICAL_EXPRESSIONS = [S2_INDEX.ndvi, S2_INDEX.bsi, S2_INDEX.ndmi, S2_INDEX.ndbi];
const RADAR_EXPRESSIONS = ["vh", "vv"];

export interface SceneRef {
  id: string;
  platform: string | null;
  cloudCover: number | null;
}

export interface Acquisition<T> {
  date: string;
  scenes: SceneRef[];
  pixels: number;
  /** Share of the district's bounding box covered by the selected scenes (0–1). */
  coverage: number;
  values: T;
}

export type OpticalValues = { ndvi: number; bsi: number; ndmi: number; ndbi: number };
export type RadarValues = { vhDb: number; vvDb: number };

export interface Indicator {
  id: "ndvi" | "bsi" | "ndmi" | "ndbi" | "vh";
  label: string;
  unit: string;
  current: number | null;
  baseline: number | null;
  delta: number | null;
  /** Direction of change that signals disturbance. */
  concern: "increase" | "decrease";
  note: string;
}

export interface ScreeningComponent {
  id: string;
  label: string;
  weight: number;
  /** Normalised signal 0–1 (1 = strongest disturbance evidence). */
  signal: number | null;
  detail: string;
}

export interface DistrictAnalysis {
  district: Omit<District, "geometry">;
  generatedAt: string;
  periods: { current: { start: string; end: string }; baseline: { start: string; end: string } };
  optical: { current: Acquisition<OpticalValues> | null; baseline: Acquisition<OpticalValues> | null };
  radar: { current: Acquisition<RadarValues> | null; baseline: Acquisition<RadarValues> | null };
  indicators: Indicator[];
  fires: { last24h: number; last7d: number; night7d: number; frp7d: number; per1000km2: number };
  miningSites: { count: number; byKind: Record<string, number>; sites: MiningSite[] };
  screening: { score: number | null; level: "low" | "moderate" | "elevated" | "high" | "insufficient-data"; components: ScreeningComponent[] };
  caveats: string[];
}

// ----------------------------------------------------------------- helpers

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;
const toDb = (linear: number) => 10 * Math.log10(linear);

function overlapFraction(a: [number, number, number, number], b: [number, number, number, number]) {
  const w = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const h = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  return (w * h) / ((b[2] - b[0]) * (b[3] - b[1]));
}

/** Approximate share of the district bbox covered by a set of scene footprints (grid sampling). */
function coverageOf(scenes: Scene[], bbox: [number, number, number, number]) {
  const N = 12;
  let hit = 0;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const x = bbox[0] + ((i + 0.5) / N) * (bbox[2] - bbox[0]);
      const y = bbox[1] + ((j + 0.5) / N) * (bbox[3] - bbox[1]);
      if (scenes.some((s) => x >= s.bbox[0] && x <= s.bbox[2] && y >= s.bbox[1] && y <= s.bbox[3])) hit++;
    }
  return hit / (N * N);
}

/**
 * Picks the single acquisition date (one satellite pass) that best covers the district,
 * so all tiles share illumination and phenology. Ties go to the most recent date.
 */
function bestPass(scenes: Scene[], bbox: [number, number, number, number]) {
  const byDate = new Map<string, Scene[]>();
  for (const s of scenes) {
    const key = s.datetime.slice(0, 10);
    byDate.set(key, [...(byDate.get(key) ?? []), s]);
  }
  let best: { date: string; scenes: Scene[]; coverage: number } | null = null;
  for (const [date, group] of byDate) {
    const relevant = group.filter((s) => overlapFraction(s.bbox, bbox) > 0).slice(0, MAX_TILES);
    const coverage = coverageOf(relevant, bbox);
    if (!best || coverage > best.coverage + 0.05 || (Math.abs(coverage - best.coverage) <= 0.05 && date > best.date)) {
      best = { date, scenes: relevant, coverage };
    }
  }
  return best;
}

/** Runs zonal statistics for every scene of a pass and merges them pixel-weighted. */
async function passStatistics(collection: string, pass: { scenes: Scene[] }, geometry: Area["geometry"], expressions: string[]) {
  const results = await Promise.all(pass.scenes.map((s) => itemStatistics(collection, s.id, geometry, expressions, 768).catch(() => null)));
  const sums = expressions.map(() => 0);
  let pixels = 0;
  for (const r of results) {
    if (!r || r.some((b) => b == null)) continue;
    const n = r[0]!.count;
    pixels += n;
    r.forEach((b, i) => (sums[i] += b!.mean * n));
  }
  return pixels > 0 ? { pixels, means: sums.map((s) => s / pixels) } : null;
}

const sceneRefs = (scenes: Scene[]): SceneRef[] => scenes.map((s) => ({ id: s.id, platform: s.platform, cloudCover: s.cloudCover }));

/** An area to analyse: any polygon with its bounding box (district, site buffer…). */
export type Area = Pick<District, "geometry" | "bbox">;

export async function opticalAcquisition(d: Area, start: string, end: string): Promise<Acquisition<OpticalValues> | null> {
  const scenes = await searchScenes({ collection: "sentinel-2-l2a", intersects: d.geometry, start, end, maxCloud: OPTICAL_MAX_CLOUD, limit: 80 });
  const pass = bestPass(scenes, d.bbox);
  if (!pass) return null;
  const stats = await passStatistics("sentinel-2-l2a", pass, d.geometry, OPTICAL_EXPRESSIONS);
  if (!stats) return null;
  const [ndvi, bsi, ndmi, ndbi] = stats.means;
  return { date: pass.date, scenes: sceneRefs(pass.scenes), pixels: stats.pixels, coverage: round(pass.coverage, 2), values: { ndvi, bsi, ndmi, ndbi } };
}

export async function radarAcquisition(d: Area, start: string, end: string): Promise<Acquisition<RadarValues> | null> {
  const scenes = await searchScenes({ collection: "sentinel-1-rtc", intersects: d.geometry, start, end, limit: 60 });
  const pass = bestPass(scenes, d.bbox);
  if (!pass) return null;
  // Average backscatter in linear power, then convert to dB (averaging dB is biased).
  const stats = await passStatistics("sentinel-1-rtc", pass, d.geometry, RADAR_EXPRESSIONS);
  if (!stats || stats.means.some((m) => m <= 0)) return null;
  return {
    date: pass.date,
    scenes: sceneRefs(pass.scenes),
    pixels: stats.pixels,
    coverage: round(pass.coverage, 2),
    values: { vhDb: toDb(stats.means[0]), vvDb: toDb(stats.means[1]) },
  };
}

// ---------------------------------------------------------------- analysis

const LEVELS = [
  { max: 25, level: "low" },
  { max: 50, level: "moderate" },
  { max: 75, level: "elevated" },
  { max: Infinity, level: "high" },
] as const;

/**
 * Full analysis for one district. `asOf` (YYYY-MM-DD) is part of the cache key, so
 * results refresh daily and every viewer shares them.
 */
export async function analyzeDistrict(d: District, asOf: string): Promise<DistrictAnalysis> {
  "use cache";
  cacheLife({ stale: 1800, revalidate: 21600, expire: 172800 });

  const opt = { end: asOf, start: shiftDays(asOf, -OPTICAL_WINDOW_DAYS) };
  const optBase = { end: shiftDays(opt.end, -365), start: shiftDays(opt.start, -365) };
  const sar = { end: asOf, start: shiftDays(asOf, -RADAR_WINDOW_DAYS) };
  const sarBase = { end: shiftDays(sar.end, -365), start: shiftDays(sar.start, -365) };

  let optical: [Acquisition<OpticalValues> | null, Acquisition<OpticalValues> | null];
  let radar: [Acquisition<RadarValues> | null, Acquisition<RadarValues> | null];
  let fires: Awaited<ReturnType<typeof getZimbabweFires>> | null;
  try {
    [optical, radar, fires] = await Promise.all([
      Promise.all([opticalAcquisition(d, opt.start, opt.end), opticalAcquisition(d, optBase.start, optBase.end)]),
      Promise.all([radarAcquisition(d, sar.start, sar.end), radarAcquisition(d, sarBase.start, sarBase.end)]),
      getZimbabweFires().catch(() => null),
    ]);
  } catch (err) {
    throw asUpstreamError(err, "Satellite analysis");
  }

  const [oc, ob] = optical;
  const [rc, rb] = radar;
  const delta = (a?: number, b?: number) => (a != null && b != null ? a - b : null);

  const indicators: Indicator[] = [
    {
      id: "ndvi",
      label: "NDVI (vegetation)",
      unit: "",
      current: oc?.values.ndvi ?? null,
      baseline: ob?.values.ndvi ?? null,
      delta: delta(oc?.values.ndvi, ob?.values.ndvi),
      concern: "decrease",
      note: "Falling NDVI → vegetation removed or stressed",
    },
    {
      id: "bsi",
      label: "BSI (bare soil)",
      unit: "",
      current: oc?.values.bsi ?? null,
      baseline: ob?.values.bsi ?? null,
      delta: delta(oc?.values.bsi, ob?.values.bsi),
      concern: "increase",
      note: "Rising BSI → newly exposed soil, pits or tailings",
    },
    {
      id: "ndmi",
      label: "NDMI (moisture)",
      unit: "",
      current: oc?.values.ndmi ?? null,
      baseline: ob?.values.ndmi ?? null,
      delta: delta(oc?.values.ndmi, ob?.values.ndmi),
      concern: "decrease",
      note: "Falling NDMI → canopy and soil drying",
    },
    {
      id: "ndbi",
      label: "NDBI (built-up)",
      unit: "",
      current: oc?.values.ndbi ?? null,
      baseline: ob?.values.ndbi ?? null,
      delta: delta(oc?.values.ndbi, ob?.values.ndbi),
      concern: "increase",
      note: "Rising NDBI → impervious surfaces or compacted ground",
    },
    {
      id: "vh",
      label: "Sentinel-1 VH backscatter",
      unit: "dB",
      current: rc?.values.vhDb ?? null,
      baseline: rb?.values.vhDb ?? null,
      delta: delta(rc?.values.vhDb, rb?.values.vhDb),
      concern: "decrease",
      note: "Falling VH → loss of woody structure (clearing, excavation)",
    },
  ];
  const ind = Object.fromEntries(indicators.map((i) => [i.id, i])) as Record<Indicator["id"], Indicator>;

  const f = fires?.byDistrict[d.id] ?? { last24h: 0, last7d: 0, night7d: 0, frp7d: 0 };
  const firesPer1000 = (f.last7d / d.areaKm2) * 1000;

  // Each component maps a physical change to 0–1; thresholds are the change at which
  // the signal saturates (chosen from typical district-scale year-on-year variability).
  const components: ScreeningComponent[] = [
    {
      id: "soil",
      label: "Soil exposure (ΔBSI)",
      weight: 0.3,
      signal: ind.bsi.delta != null ? clamp01(ind.bsi.delta / 0.08) : null,
      detail: "Saturates at +0.08 BSI year-on-year",
    },
    {
      id: "vegetation",
      label: "Vegetation loss (ΔNDVI)",
      weight: 0.25,
      signal: ind.ndvi.delta != null ? clamp01(-ind.ndvi.delta / 0.1) : null,
      detail: "Saturates at −0.10 NDVI year-on-year",
    },
    {
      id: "moisture",
      label: "Moisture loss (ΔNDMI)",
      weight: 0.1,
      signal: ind.ndmi.delta != null ? clamp01(-ind.ndmi.delta / 0.1) : null,
      detail: "Saturates at −0.10 NDMI year-on-year",
    },
    {
      id: "radar",
      label: "Radar backscatter loss (ΔVH)",
      weight: 0.15,
      signal: ind.vh.delta != null ? clamp01(-ind.vh.delta / 2) : null,
      detail: "Saturates at −2 dB VH year-on-year (all-weather, sees through cloud)",
    },
    {
      id: "fire",
      label: "Fire activity (VIIRS, 7 days)",
      weight: 0.2,
      signal: fires ? clamp01(firesPer1000 / 25) : null,
      detail: "Saturates at 25 detections per 1,000 km² per week",
    },
  ];

  const available = components.filter((c) => c.signal != null);
  const weight = available.reduce((s, c) => s + c.weight, 0);
  const score = weight >= 0.5 ? Math.round((available.reduce((s, c) => s + c.weight * c.signal!, 0) / weight) * 100) : null;
  const level = score == null ? "insufficient-data" : LEVELS.find((l) => score <= l.max)!.level;

  const sites = sitesInDistrict(d.id);
  const byKind: Record<string, number> = {};
  for (const s of sites) byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;

  const caveats = [
    "Screening indicator only — it cannot tell licensed from unlicensed activity without the mining cadastre.",
    "District-wide means dilute small artisanal sites; use the map layers to inspect individual locations.",
  ];
  if (!oc || !ob) caveats.push("No sufficiently cloud-free Sentinel-2 pass in one of the periods; optical components are excluded.");
  if (oc && oc.coverage < 0.6) caveats.push(`The selected Sentinel-2 pass covers about ${Math.round(oc.coverage * 100)}% of the district.`);
  if (oc && ob && Math.abs(Date.parse(oc.date) - Date.parse(ob.date) - 365 * 86_400_000) > 30 * 86_400_000)
    caveats.push("Current and baseline passes are more than a month apart in season; seasonal effects may remain.");
  if (!fires) caveats.push("NASA FIRMS was unavailable; the fire component is excluded.");

  const { geometry: _g, ...district } = d;
  void _g;

  return {
    district,
    generatedAt: new Date().toISOString(),
    periods: { current: opt, baseline: optBase },
    optical: { current: oc, baseline: ob },
    radar: { current: rc, baseline: rb },
    indicators,
    fires: { ...f, per1000km2: round(firesPer1000, 1) },
    miningSites: { count: sites.length, byKind, sites },
    screening: { score, level, components },
    caveats,
  };
}
