import "server-only";
import type { HealthReport, ServiceStatus } from "@/lib/data/types";
import pkg from "../../../package.json";

const PROBES: { id: string; name: string; url: string }[] = [
  {
    id: "air-quality",
    name: "Open-Meteo Air Quality",
    url: "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=0&longitude=0&current=european_aqi",
  },
  { id: "forecast", name: "Open-Meteo Forecast", url: "https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&current=temperature_2m" },
  { id: "geocoding", name: "Open-Meteo Geocoding", url: "https://geocoding-api.open-meteo.com/v1/search?name=milan&count=1" },
  { id: "radar", name: "RainViewer Radar", url: "https://api.rainviewer.com/public/weather-maps.json" },
];

async function probe(p: (typeof PROBES)[number]): Promise<ServiceStatus> {
  const started = performance.now();
  try {
    const res = await fetch(p.url, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    return { id: p.id, name: p.name, ok: res.ok, latencyMs: Math.round(performance.now() - started) };
  } catch {
    return { id: p.id, name: p.name, ok: false, latencyMs: null };
  }
}

export async function checkHealth(): Promise<HealthReport> {
  const services = await Promise.all(PROBES.map(probe));
  const up = services.filter((s) => s.ok).length;
  return {
    status: up === services.length ? "operational" : up === 0 ? "down" : "degraded",
    checkedAt: new Date().toISOString(),
    version: pkg.version,
    services,
  };
}
