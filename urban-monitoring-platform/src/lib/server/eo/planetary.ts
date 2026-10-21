import "server-only";
import { cacheLife } from "next/cache";
import { ApiError } from "../http";

/**
 * Microsoft Planetary Computer: open STAC catalogue + Titiler tile/statistics service.
 * No account or key is required for search, rendering and statistics.
 */
const STAC = "https://planetarycomputer.microsoft.com/api/stac/v1";
const DATA = "https://planetarycomputer.microsoft.com/api/data/v1";
const UA = "UrbanMonitoringPlatform/2.0";

type Geometry = { type: "Polygon" | "MultiPolygon"; coordinates: unknown };

/** Caps concurrent statistics calls per server instance so bursts are not throttled upstream. */
const MAX_CONCURRENT_STATS = 8;
let activeStats = 0;
const waiting: (() => void)[] = [];
async function withStatsSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (activeStats >= MAX_CONCURRENT_STATS) await new Promise<void>((resolve) => waiting.push(resolve));
  activeStats++;
  try {
    return await fn();
  } finally {
    activeStats--;
    waiting.shift()?.();
  }
}

async function pc<T>(url: string, init: RequestInit & { label: string; timeoutMs?: number }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", "User-Agent": UA, ...init.headers },
      signal: AbortSignal.timeout(init.timeoutMs ?? 20_000),
    });
  } catch (err) {
    throw new ApiError(502, `${init.label} is unreachable`, String(err));
  }
  if (!res.ok) throw new ApiError(502, `${init.label} responded with ${res.status}`, (await res.text()).slice(0, 300));
  return (await res.json()) as T;
}

// ------------------------------------------------------------------ search

export interface Scene {
  id: string;
  collection: string;
  datetime: string;
  platform: string | null;
  cloudCover: number | null;
  bbox: [number, number, number, number];
}

type StacFeature = { id: string; collection: string; bbox: [number, number, number, number]; properties: Record<string, unknown> };

const toScene = (f: StacFeature): Scene => ({
  id: f.id,
  collection: f.collection,
  datetime: String(f.properties.datetime),
  platform: (f.properties.platform as string) ?? null,
  cloudCover: typeof f.properties["eo:cloud_cover"] === "number" ? (f.properties["eo:cloud_cover"] as number) : null,
  bbox: f.bbox,
});

export interface SceneQuery {
  collection: string;
  /** Either a bbox or a geometry to intersect. */
  bbox?: [number, number, number, number];
  intersects?: Geometry;
  /** ISO dates (YYYY-MM-DD), inclusive. */
  start?: string;
  end?: string;
  maxCloud?: number;
  filter?: object[];
  limit?: number;
}

function cqlFilter(q: Pick<SceneQuery, "start" | "end" | "maxCloud" | "filter">) {
  const args: object[] = [...(q.filter ?? [])];
  if (q.start && q.end) args.push({ op: "anyinteracts", args: [{ property: "datetime" }, { interval: [`${q.start}T00:00:00Z`, `${q.end}T23:59:59Z`] }] });
  if (q.maxCloud != null) args.push({ op: "<=", args: [{ property: "eo:cloud_cover" }, q.maxCloud] });
  return args.length === 0 ? undefined : args.length === 1 ? args[0] : { op: "and", args };
}

/** STAC item search, newest first. */
export async function searchScenes(q: SceneQuery): Promise<Scene[]> {
  "use cache";
  cacheLife({ stale: 900, revalidate: 3600, expire: 86400 });
  const filter = cqlFilter(q);
  const body = {
    collections: [q.collection],
    ...(q.bbox ? { bbox: q.bbox } : {}),
    ...(q.intersects ? { intersects: q.intersects } : {}),
    ...(filter ? { "filter-lang": "cql2-json", filter } : {}),
    sortby: [{ field: "datetime", direction: "desc" }],
    limit: q.limit ?? 20,
  };
  const data = await pc<{ features?: StacFeature[] }>(`${STAC}/search`, { method: "POST", body: JSON.stringify(body), label: "Planetary Computer STAC" });
  return (data.features ?? []).map(toScene);
}

// ------------------------------------------------------------------ mosaics

/**
 * Registers a dynamic mosaic for a collection/time window. Tiles are composited from
 * matching scenes, least-cloudy first. Registration is cached: same inputs → same id.
 */
export async function registerMosaic(q: Pick<SceneQuery, "collection" | "start" | "end" | "maxCloud" | "filter">): Promise<string> {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 21600, expire: 172800 });
  const filter = cqlFilter(q);
  const body = {
    collections: [q.collection],
    ...(filter ? { "filter-lang": "cql2-json", filter } : {}),
    sortby: q.maxCloud != null ? [{ field: "eo:cloud_cover", direction: "asc" }] : [{ field: "datetime", direction: "desc" }],
  };
  const data = await pc<{ id: string }>(`${DATA}/mosaic/register`, { method: "POST", body: JSON.stringify(body), label: "Planetary Computer mosaic" });
  return data.id;
}

/** Leaflet tile template for a registered mosaic (PNG keeps nodata transparent). */
export function mosaicTileUrl(mosaicId: string, collection: string, render: Record<string, string | string[]>) {
  const qs = new URLSearchParams({ collection });
  for (const [k, v] of Object.entries(render)) for (const item of Array.isArray(v) ? v : [v]) qs.append(k, item);
  return `${DATA}/mosaic/${mosaicId}/tiles/WebMercatorQuad/{z}/{x}/{y}@1x.png?${qs}`;
}

// --------------------------------------------------------------- statistics

export interface BandStats {
  mean: number;
  min: number;
  max: number;
  std: number;
  count: number;
}

/**
 * Zonal statistics of one or more band-math expressions over a polygon, for one item.
 * `maxSize` caps the read resolution (pixels on the long side) to keep calls fast.
 */
export async function itemStatistics(collection: string, itemId: string, geometry: Geometry, expressions: string[], maxSize = 1024) {
  "use cache";
  cacheLife("max"); // a given scene + polygon never changes
  const qs = new URLSearchParams({ collection, item: itemId, expression: expressions.join(";"), asset_as_band: "true", max_size: String(maxSize) });
  const data = await withStatsSlot(() =>
    pc<{ properties?: { statistics?: Record<string, BandStats> } }>(`${DATA}/item/statistics?${qs}`, {
      method: "POST",
      body: JSON.stringify({ type: "Feature", properties: {}, geometry }),
      label: "Planetary Computer statistics",
      timeoutMs: 30_000,
    }),
  );
  const stats = data.properties?.statistics ?? {};
  // Results come back keyed by expression, in order.
  return expressions.map((_, i) => {
    const s = Object.values(stats)[i];
    return s && Number.isFinite(s.mean) && s.count > 0 ? { mean: s.mean, min: s.min, max: s.max, std: s.std, count: s.count } : null;
  });
}
