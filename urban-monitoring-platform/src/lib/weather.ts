import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun, type LucideIcon } from "lucide-react";

/** WMO weather interpretation codes (as used by Open-Meteo). */
export function describeWeather(code: number | null): { label: string; icon: LucideIcon } {
  if (code == null) return { label: "—", icon: Cloud };
  if (code === 0) return { label: "Clear sky", icon: Sun };
  if (code <= 2) return { label: code === 1 ? "Mainly clear" : "Partly cloudy", icon: CloudSun };
  if (code === 3) return { label: "Overcast", icon: Cloud };
  if (code <= 48) return { label: "Fog", icon: CloudFog };
  if (code <= 57) return { label: "Drizzle", icon: CloudDrizzle };
  if (code <= 67) return { label: code >= 66 ? "Freezing rain" : "Rain", icon: CloudRain };
  if (code <= 77) return { label: "Snow", icon: CloudSnow };
  if (code <= 82) return { label: "Rain showers", icon: CloudRain };
  if (code <= 86) return { label: "Snow showers", icon: CloudSnow };
  return { label: "Thunderstorm", icon: CloudLightning };
}

const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export const compass = (deg: number | null) => (deg == null ? "" : DIRS[Math.round(deg / 45) % 8]);

/** Formats an Open-Meteo local wall-clock timestamp ("2026-10-21T14:00") without shifting time zones. */
export function wallClock(t: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(`${t.length === 16 ? t : t.slice(0, 16)}:00Z`).toLocaleString("en-GB", { ...opts, timeZone: "UTC" });
}

/** European AQI sub-index bands for PM2.5 (µg/m³), as used by Open-Meteo/CAMS. */
export const PM25_BANDS = [
  { max: 10, label: "Good", color: "#34d399" },
  { max: 20, label: "Fair", color: "#a3e635" },
  { max: 25, label: "Moderate", color: "#fbbf24" },
  { max: 50, label: "Poor", color: "#fb923c" },
  { max: 75, label: "Very poor", color: "#f43f5e" },
  { max: Infinity, label: "Extremely poor", color: "#9333ea" },
] as const;

export const pm25Band = (v: number | null) => (v == null ? null : PM25_BANDS.find((b) => v <= b.max)!);
