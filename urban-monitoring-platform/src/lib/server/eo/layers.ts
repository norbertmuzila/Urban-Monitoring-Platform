import "server-only";
import { EO_LAYERS, getEoLayer, type EoLayer, type EoLayerInfo } from "@/lib/eo/layers";
import { ApiError, asUpstreamError } from "../http";
import { mosaicTileUrl, registerMosaic, searchScenes, type Scene } from "./planetary";

export const EO_WINDOW_DAYS = [15, 30, 60, 90, 180] as const;
export const EO_EARLIEST_DATE = "2017-01-01";

const DAY = 86_400_000;
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
export const todayUtc = () => isoDate(new Date());
export const shiftDays = (date: string, days: number) => isoDate(new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY));

export function toInfo(layer: EoLayer): EoLayerInfo {
  const { render: _r, filter: _f, ...info } = layer;
  void _r;
  void _f;
  return info;
}

export const listEoLayers = () => EO_LAYERS.map(toInfo);

function requireLayer(id: string) {
  const layer = getEoLayer(id);
  if (!layer) throw new ApiError(404, `Unknown layer '${id}'`);
  return layer;
}

export interface LayerWindow {
  start: string;
  end: string;
}

export interface ResolvedLayer {
  layer: EoLayerInfo;
  tileUrl: string;
  /** Highest zoom the source serves natively; Leaflet upsamples beyond it. */
  maxNativeZoom: number;
  window: LayerWindow | null;
}

/** Tile template for a layer and time window (window ignored for static products). */
export async function resolveLayer(id: string, end: string, days: number): Promise<ResolvedLayer> {
  const layer = requireLayer(id);
  const window = layer.temporal === "recent" ? { start: shiftDays(end, -days), end } : null;

  if (layer.source.kind === "gibs") {
    // Nightly product: show the most recent night inside the window.
    const night = shiftDays(end, -1);
    return {
      layer: toInfo(layer),
      tileUrl: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer.source.layer}/default/${night}/GoogleMapsCompatible_Level${layer.source.maxZoom}/{z}/{y}/{x}.png`,
      maxNativeZoom: layer.source.maxZoom,
      window: { start: night, end: night },
    };
  }

  let mosaicId: string;
  try {
    mosaicId = await registerMosaic({
      collection: layer.source.collection,
      start: window?.start,
      end: window?.end,
      maxCloud: layer.maxCloud,
      filter: layer.filter,
    });
  } catch (err) {
    throw asUpstreamError(err, "Planetary Computer mosaic");
  }
  return {
    layer: toInfo(layer),
    tileUrl: mosaicTileUrl(mosaicId, layer.source.collection, layer.render ?? {}),
    maxNativeZoom: 18,
    window,
  };
}

/** Scenes from the layer's collection that intersect the viewport inside the window. */
export async function layerScenes(id: string, end: string, days: number, bbox: [number, number, number, number]): Promise<Scene[]> {
  const layer = requireLayer(id);
  if (layer.source.kind !== "planetary-computer") return [];
  const window = layer.temporal === "recent" ? { start: shiftDays(end, -days), end } : {};
  try {
    return await searchScenes({
      collection: layer.source.collection,
      bbox,
      ...window,
      maxCloud: layer.maxCloud,
      filter: layer.filter,
      limit: 12,
    });
  } catch (err) {
    throw asUpstreamError(err, "Planetary Computer STAC");
  }
}
