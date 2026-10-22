"use client";

import useSWR, { type SWRConfiguration } from "swr";
import type { EnvironmentSnapshot, HealthReport, LatLng } from "@/lib/data/types";
import type { EoGroup, EoLayerInfo } from "@/lib/eo/layers";
import type { PolygonGeometry } from "@/lib/geo";
import type { DistrictAnalysis } from "@/lib/server/eo/district-analysis";
import type { FireDetection } from "@/lib/server/eo/firms";
import type { ResolvedLayer } from "@/lib/server/eo/layers";
import type { Scene } from "@/lib/server/eo/planetary";
import type { SensorStatus } from "@/lib/server/eo/status";
import type { MiningSite } from "@/lib/server/eo/zimbabwe";
import type { CountryInfo, Place } from "@/lib/server/geo";
import type { Prediction } from "@/lib/server/model/predict";
import type { GeocodeResult } from "@/lib/server/open-meteo";
import type { RadarFrame } from "@/lib/server/rainviewer";
import type { CountryIndicators } from "@/lib/server/worldbank";

export class FetchError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new FetchError(res.status, body?.error ?? `Request failed (${res.status})`);
  return body as T;
}

const live: SWRConfiguration = { refreshInterval: 300_000, revalidateOnFocus: true, keepPreviousData: true };
const stable: SWRConfiguration = { revalidateOnFocus: false, keepPreviousData: true };

export const useHealth = () => useSWR<HealthReport>("/api/health", fetcher, { refreshInterval: 60_000 });

// ------------------------------------------------------------------ locations

export type CountrySummary = Omit<CountryInfo, "states"> & { stateCount: number };

export const useCountries = () => useSWR<{ source: string; countries: CountrySummary[] }>("/api/geo/countries", fetcher, { revalidateOnFocus: false });

export const useCountry = (iso2: string | null) =>
  useSWR<{ country: CountryInfo; largestCities: Place[] }>(iso2 ? `/api/geo/countries/${iso2}` : null, fetcher, stable);

export const useCities = (iso2: string | null, state: string | null) =>
  useSWR<{ source: string; cities: Place[] }>(iso2 ? `/api/geo/countries/${iso2}/cities${state ? `?state=${encodeURIComponent(state)}` : ""}` : null, fetcher, stable);

export const useGeocode = (query: string, country: string | null = null) =>
  useSWR<{ results: GeocodeResult[] }>(
    query.trim().length >= 2 ? `/api/geocode?q=${encodeURIComponent(query.trim())}${country ? `&country=${country}` : ""}` : null,
    fetcher,
    { keepPreviousData: true },
  );

// ------------------------------------------------------------- live & predict

export const useEnvironment = (loc: LatLng | null) =>
  useSWR<EnvironmentSnapshot>(loc ? `/api/environment?lat=${loc.lat}&lng=${loc.lng}` : null, fetcher, live);

export const usePrediction = (loc: LatLng | null) =>
  useSWR<Prediction>(loc ? `/api/predict?lat=${loc.lat.toFixed(2)}&lng=${loc.lng.toFixed(2)}` : null, fetcher, { ...stable, refreshInterval: 1_800_000 });

export interface LiveCity {
  id: number;
  name: string;
  state: string;
  population: number;
  lat: number;
  lng: number;
  aqi: number | null;
  pm25: number | null;
  temperature: number | null;
  observedAt: string | null;
}

export const useCountryCitiesLive = (iso2: string | null) => useSWR<{ cities: LiveCity[] }>(iso2 ? `/api/country/${iso2}/cities-live` : null, fetcher, live);

export const useRadar = (enabled: boolean) => useSWR<{ frames: RadarFrame[] }>(enabled ? "/api/radar" : null, fetcher, { refreshInterval: 300_000 });

// -------------------------------------------------------------- country data

export interface CountryProfile {
  country: CountrySummary;
  indicators: CountryIndicators;
  fires: { last24h: number; night: number; highFrp: number; latestAcquisition: string | null; fetchedAt: string; source: string } | null;
  sources: { countries: string; cities: string; shapes: string };
}

export const useCountryProfile = (iso2: string | null) => useSWR<CountryProfile>(iso2 ? `/api/country/${iso2}` : null, fetcher, stable);

type Feature<G, P> = { type: "Feature"; id?: string; properties: P; geometry: G };

export type CountryFires = {
  type: "FeatureCollection";
  meta: { country: string; total: number; latestAcquisition: string | null; source: string };
  features: Feature<{ type: "Point"; coordinates: [number, number] }, { frp: number; acquired: string; night: boolean }>[];
};
export const useCountryFires = (iso2: string | null) => useSWR<CountryFires>(iso2 ? `/api/country/${iso2}/fires` : null, fetcher, stable);

export type CountryShape = Feature<PolygonGeometry | null, { iso2: string; name: string }> & { bbox: [number, number, number, number] | null };
export const useCountryShape = (iso2: string | null) => useSWR<CountryShape>(iso2 ? `/api/country/${iso2}/shape` : null, fetcher, { revalidateOnFocus: false });

// ------------------------------------------------------------ Earth observation

export const useEoLayers = () =>
  useSWR<{ groups: EoGroup[]; layers: EoLayerInfo[]; windows: number[] }>("/api/eo/layers", fetcher, { revalidateOnFocus: false });

const eoQuery = (layer: string, days: number, end: string) => `layer=${encodeURIComponent(layer)}&days=${days}&end=${end}`;

export const useEoTiles = (layer: string | null, days: number, end: string) =>
  useSWR<ResolvedLayer>(layer ? `/api/eo/tiles?${eoQuery(layer, days, end)}` : null, fetcher, stable);

export const useEoScenes = (layer: string | null, days: number, end: string, bbox: [number, number, number, number] | null) =>
  useSWR<{ scenes: Scene[] }>(
    layer && bbox ? `/api/eo/scenes?${eoQuery(layer, days, end)}&bbox=${bbox.map((n) => n.toFixed(3)).join(",")}` : null,
    fetcher,
    stable,
  );

export const useEoStatus = () => useSWR<{ checkedAt: string; sensors: SensorStatus[]; areas: string[] }>("/api/eo/status", fetcher, { refreshInterval: 600_000 });

// ---------------------------------------------------------------- Zimbabwe watch

export const useZwOverview = () => useSWR<ZwOverview>("/api/zw/overview", fetcher, { refreshInterval: 900_000, revalidateOnFocus: false });

export const useZwDistrictShapes = () => useSWR<DistrictShapes>("/api/zw/districts", fetcher, { revalidateOnFocus: false });

export const useZwFires = (enabled: boolean) => useSWR<FirePoints>(enabled ? "/api/zw/fires" : null, fetcher, { refreshInterval: 900_000, revalidateOnFocus: false });

export const useZwSites = (enabled: boolean) => useSWR<SitePoints>(enabled ? "/api/zw/sites" : null, fetcher, { revalidateOnFocus: false });

export const useDistrictAnalysis = (id: string | null) =>
  useSWR<DistrictAnalysis>(id ? `/api/zw/districts/${encodeURIComponent(id)}/analysis` : null, fetcher, { revalidateOnFocus: false, shouldRetryOnError: false });

export interface ZwOverviewDistrict {
  id: string;
  name: string;
  urban: boolean;
  areaKm2: number;
  centroid: [number, number];
  bbox: [number, number, number, number];
  miningSites: number;
  fires24h: number;
  fires7d: number;
  night7d: number;
  firesPer1000km2: number;
}

export interface ZwOverview {
  districts: ZwOverviewDistrict[];
  totals: { districts: number; miningSites: number; last24h: number; last7d: number };
  firms: { fetchedAt: string; latestAcquisition: string | null; source: string };
  sources: { districts: { source: string; license: string; year: string }; miningSites: { source: string; license: string; snapshot: string } };
}

export type DistrictShapes = {
  type: "FeatureCollection";
  features: Feature<PolygonGeometry, { id: string; name: string; urban: boolean; areaKm2: number }>[];
};
export type FirePoints = {
  type: "FeatureCollection";
  meta: { latestAcquisition: string | null };
  features: Feature<{ type: "Point"; coordinates: [number, number] }, Omit<FireDetection, "lat" | "lng">>[];
};
export type SitePoints = {
  type: "FeatureCollection";
  meta: { source: string; license: string; snapshot: string };
  features: Feature<{ type: "Point"; coordinates: [number, number] }, Omit<MiningSite, "lat" | "lng">>[];
};
