import { palette } from "./format";

/** European Air Quality Index bands (EEA / CAMS), the scale Open-Meteo reports. */
const BANDS = [
  { max: 20, label: "Good", color: palette.ok },
  { max: 40, label: "Fair", color: "#a3e635" },
  { max: 60, label: "Moderate", color: palette.warn },
  { max: 80, label: "Poor", color: palette.alert },
  { max: 100, label: "Very poor", color: palette.danger },
  { max: Infinity, label: "Extremely poor", color: "#9333ea" },
] as const;

export function aqiBand(aqi: number | null | undefined) {
  if (aqi == null) return { label: "No data", color: palette.subtle };
  return BANDS.find((b) => aqi <= b.max)!;
}

export const AQI_LEGEND = BANDS.map((b, i) => ({ ...b, from: i === 0 ? 0 : BANDS[i - 1].max }));
