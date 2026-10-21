import "server-only";
import { cacheLife } from "next/cache";
import { asUpstreamError, upstream } from "./http";

type WeatherMaps = {
  host: string;
  radar?: { past?: { time: number; path: string }[] };
};

export interface RadarFrame {
  time: string;
  /** Leaflet tile URL template. */
  tileUrl: string;
}

async function fetchWeatherMaps() {
  "use cache";
  // New radar frames are published every 10 minutes.
  cacheLife({ stale: 120, revalidate: 300, expire: 1800 });
  return upstream<WeatherMaps>("https://api.rainviewer.com/public/weather-maps.json", { label: "RainViewer" });
}

/** Latest RainViewer radar frames (last ~2 h, 10-minute steps). */
export async function getRadarFrames(): Promise<RadarFrame[]> {
  let data: WeatherMaps;
  try {
    data = await fetchWeatherMaps();
  } catch (err) {
    throw asUpstreamError(err, "RainViewer");
  }
  return (data.radar?.past ?? []).map((f) => ({
    time: new Date(f.time * 1000).toISOString(),
    // 256px tiles, colour scheme 2 (universal blue), smoothed, with snow
    tileUrl: `${data.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`,
  }));
}
