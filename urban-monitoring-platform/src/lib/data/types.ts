// Domain types shared by the API layer (src/app/api) and the UI.

export type LatLng = { lat: number; lng: number };

/** A place the user is monitoring (any city/town worldwide). */
export interface Location extends LatLng {
  /** GeoNames id. */
  id: number;
  name: string;
  state: string | null;
  country: string;
  iso2: string;
  population: number | null;
}

export interface Pollutants {
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  so2: number | null;
  o3: number | null;
  co: number | null;
}

export interface SourceLink {
  label: string;
  /** Exact upstream request used — open it to verify the numbers. */
  url: string;
}

export interface EnvironmentSnapshot {
  location: LatLng;
  timezone: string | null;
  observedAt: string;
  /** European Air Quality Index (CAMS), 0–100+. */
  aqi: number | null;
  pollutants: Pollutants;
  temperature: number | null;
  apparentTemperature: number | null;
  humidity: number | null;
  pressure: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  precipitation: number | null;
  cloudCover: number | null;
  /** WMO weather interpretation code. */
  weatherCode: number | null;
  /** Last 24 hourly observations, oldest first. */
  hourly: { time: string[]; temperature: (number | null)[]; humidity: (number | null)[] };
  sources: SourceLink[];
}

export interface ServiceStatus {
  id: string;
  name: string;
  ok: boolean;
  latencyMs: number | null;
}

export interface HealthReport {
  status: "operational" | "degraded" | "down";
  checkedAt: string;
  version: string;
  services: ServiceStatus[];
}
