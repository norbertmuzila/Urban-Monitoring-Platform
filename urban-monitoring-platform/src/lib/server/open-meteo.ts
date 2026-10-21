import "server-only";
import { cacheLife } from "next/cache";
import { asUpstreamError, upstream } from "./http";
import type { EnvironmentSnapshot } from "@/lib/data/types";

const AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";

type AirQualityResponse = {
  current?: {
    time: string;
    european_aqi?: number | null;
    pm2_5?: number | null;
    pm10?: number | null;
    nitrogen_dioxide?: number | null;
    sulphur_dioxide?: number | null;
    ozone?: number | null;
    carbon_monoxide?: number | null;
  };
};

type ForecastResponse = {
  timezone?: string;
  current?: {
    time: string;
    temperature_2m?: number | null;
    apparent_temperature?: number | null;
    relative_humidity_2m?: number | null;
    surface_pressure?: number | null;
    wind_speed_10m?: number | null;
    wind_direction_10m?: number | null;
    precipitation?: number | null;
    cloud_cover?: number | null;
    weather_code?: number | null;
  };
  hourly?: { time: string[]; temperature_2m: (number | null)[]; relative_humidity_2m: (number | null)[] };
};

/** Rounds coordinates so nearby requests share one cache entry (~1 km). */
const q = (n: number) => n.toFixed(2);

const airUrl = (lat: string, lng: string) =>
  `${AIR_QUALITY_URL}?latitude=${lat}&longitude=${lng}&timezone=auto&current=european_aqi,pm10,pm2_5,nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide`;
const weatherUrl = (lat: string, lng: string) =>
  `${FORECAST_URL}?latitude=${lat}&longitude=${lng}&timezone=auto` +
  `&current=temperature_2m,apparent_temperature,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,precipitation,cloud_cover,weather_code` +
  `&hourly=temperature_2m,relative_humidity_2m&past_hours=23&forecast_hours=1`;

// Open-Meteo refreshes air quality hourly and weather every 15 min: cache for 10 min.
async function fetchAirQuality(lat: string, lng: string) {
  "use cache";
  cacheLife({ stale: 300, revalidate: 600, expire: 3600 });
  return upstream<AirQualityResponse>(airUrl(lat, lng), { label: "Open-Meteo Air Quality" });
}

async function fetchForecast(lat: string, lng: string) {
  "use cache";
  cacheLife({ stale: 300, revalidate: 600, expire: 3600 });
  return upstream<ForecastResponse>(weatherUrl(lat, lng), { label: "Open-Meteo Forecast" });
}

export async function getEnvironment(lat: number, lng: number): Promise<EnvironmentSnapshot> {
  // Air quality and weather are independent: one failing should not blank the other.
  const [aq, wx] = await Promise.allSettled([fetchAirQuality(q(lat), q(lng)), fetchForecast(q(lat), q(lng))]);
  if (aq.status === "rejected" && wx.status === "rejected") throw asUpstreamError(aq.reason, "Open-Meteo");

  const a = aq.status === "fulfilled" ? aq.value.current : undefined;
  const w = wx.status === "fulfilled" ? wx.value.current : undefined;
  const h = wx.status === "fulfilled" ? wx.value.hourly : undefined;

  const sources: EnvironmentSnapshot["sources"] = [];
  if (a) sources.push({ label: "Air quality — Copernicus CAMS via Open-Meteo", url: airUrl(q(lat), q(lng)) });
  if (w) sources.push({ label: "Weather — ECMWF/DWD best-match via Open-Meteo", url: weatherUrl(q(lat), q(lng)) });

  return {
    location: { lat, lng },
    timezone: wx.status === "fulfilled" ? (wx.value.timezone ?? null) : null,
    observedAt: w?.time ?? a?.time ?? new Date().toISOString(),
    aqi: a?.european_aqi ?? null,
    pollutants: {
      pm25: a?.pm2_5 ?? null,
      pm10: a?.pm10 ?? null,
      no2: a?.nitrogen_dioxide ?? null,
      so2: a?.sulphur_dioxide ?? null,
      o3: a?.ozone ?? null,
      co: a?.carbon_monoxide ?? null,
    },
    temperature: w?.temperature_2m ?? null,
    apparentTemperature: w?.apparent_temperature ?? null,
    humidity: w?.relative_humidity_2m ?? null,
    pressure: w?.surface_pressure ?? null,
    windSpeed: w?.wind_speed_10m ?? null,
    windDirection: w?.wind_direction_10m ?? null,
    precipitation: w?.precipitation ?? null,
    cloudCover: w?.cloud_cover ?? null,
    weatherCode: w?.weather_code ?? null,
    hourly: {
      time: h?.time ?? [],
      temperature: h?.temperature_2m ?? [],
      humidity: h?.relative_humidity_2m ?? [],
    },
    sources,
  };
}

export interface CurrentConditions {
  aqi: number | null;
  pm25: number | null;
  temperature: number | null;
  observedAt: string | null;
}

/**
 * Current AQI, PM2.5 and temperature for several places in two requests (Open-Meteo
 * accepts comma-separated coordinates and answers with an array in the same order).
 */
export async function getCurrentBatch(lats: string, lngs: string): Promise<CurrentConditions[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 600, expire: 3600 });
  const loc = `latitude=${lats}&longitude=${lngs}&timezone=auto`;
  const n = lats.split(",").length;
  const asArray = <T,>(v: T | T[]) => (Array.isArray(v) ? v : [v]);
  const [aq, wx] = await Promise.allSettled([
    upstream<AirQualityResponse | AirQualityResponse[]>(`${AIR_QUALITY_URL}?${loc}&current=european_aqi,pm2_5`, { label: "Open-Meteo Air Quality" }),
    upstream<ForecastResponse | ForecastResponse[]>(`${FORECAST_URL}?${loc}&current=temperature_2m`, { label: "Open-Meteo Forecast" }),
  ]);
  // Don't cache half-empty results for every city: fail uncached so the next request retries.
  for (const r of [aq, wx]) if (r.status === "rejected") throw asUpstreamError(r.reason, "Open-Meteo");
  const a = aq.status === "fulfilled" ? asArray(aq.value) : [];
  const w = wx.status === "fulfilled" ? asArray(wx.value) : [];
  return Array.from({ length: n }, (_, i) => ({
    aqi: a[i]?.current?.european_aqi ?? null,
    pm25: a[i]?.current?.pm2_5 ?? null,
    temperature: w[i]?.current?.temperature_2m ?? null,
    observedAt: w[i]?.current?.time ?? a[i]?.current?.time ?? null,
  }));
}

export interface GeocodeResult {
  id: number;
  name: string;
  country: string;
  iso2: string;
  admin1: string | null;
  lat: number;
  lng: number;
  population: number | null;
}

type GeocodingResponse = {
  results?: {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
    country_code?: string;
    admin1?: string;
    population?: number;
  }[];
};

async function fetchGeocoding(query: string, count: number, country: string | null) {
  "use cache";
  cacheLife("days");
  const filter = country ? `&countryCode=${country}` : "";
  return upstream<GeocodingResponse>(`${GEOCODING_URL}?name=${encodeURIComponent(query)}&count=${count}&language=en&format=json${filter}`, {
    label: "Open-Meteo Geocoding",
  });
}

/** Place search (GeoNames via Open-Meteo), optionally limited to one country (ISO alpha-2). */
export async function geocode(query: string, count = 8, country: string | null = null): Promise<GeocodeResult[]> {
  let data: GeocodingResponse;
  try {
    data = await fetchGeocoding(query.toLowerCase(), count, country);
  } catch (err) {
    throw asUpstreamError(err, "Open-Meteo Geocoding");
  }
  return (data.results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    country: r.country ?? "",
    iso2: (r.country_code ?? "").toLowerCase(),
    admin1: r.admin1 ?? null,
    lat: r.latitude,
    lng: r.longitude,
    population: r.population ?? null,
  }));
}
