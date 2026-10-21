import "server-only";
import { cacheLife } from "next/cache";
import { getZimbabweFires } from "./firms";
import { searchScenes } from "./planetary";
import { ZIMBABWE_BBOX } from "./zimbabwe";
import type { BBox } from "@/lib/geo";

export interface SensorStatus {
  id: string;
  name: string;
  role: string;
  latest: string | null;
  platform: string | null;
  ok: boolean;
}

/** Study areas whose latest acquisitions are reported (Zimbabwe + the urban pilot cities). */
const AREAS: { id: string; bbox: BBox }[] = [
  { id: "zimbabwe", bbox: ZIMBABWE_BBOX },
  { id: "milan", bbox: [9.05, 45.38, 9.3, 45.54] },
  { id: "singapore", bbox: [103.6, 1.2, 104.05, 1.48] },
  { id: "nairobi", bbox: [36.65, -1.45, 37.05, -1.15] },
];

const SENSORS = [
  { id: "s2", name: "Sentinel-2 MSI", role: "Optical indices (NDVI, BSI, NDMI, NDBI, NDTI)", collection: "sentinel-2-l2a" },
  { id: "s1", name: "Sentinel-1 C-SAR", role: "All-weather radar backscatter", collection: "sentinel-1-rtc" },
  { id: "landsat", name: "Landsat 8/9 OLI/TIRS", role: "Land surface temperature", collection: "landsat-c2-l2" },
] as const;

const latestOf = async (collection: string, bbox: BBox) => (await searchScenes({ collection, bbox, limit: 1 }))[0] ?? null;

/** Most recent acquisition per sensor across all study areas, plus FIRMS. */
export async function getSensorStatus(): Promise<{ checkedAt: string; sensors: SensorStatus[]; areas: string[] }> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 1800, expire: 21600 });

  const sensors: SensorStatus[] = await Promise.all(
    SENSORS.map(async (s) => {
      const results = await Promise.all(AREAS.map((a) => latestOf(s.collection, a.bbox).catch(() => null)));
      const latest = results.filter((r) => r != null).sort((a, b) => b!.datetime.localeCompare(a!.datetime))[0] ?? null;
      return { id: s.id, name: s.name, role: s.role, latest: latest?.datetime ?? null, platform: latest?.platform ?? null, ok: latest != null };
    }),
  );

  const fires = await getZimbabweFires().catch(() => null);
  sensors.push({
    id: "viirs",
    name: "VIIRS 375 m (NOAA-20)",
    role: "Active fires & thermal anomalies (NASA FIRMS)",
    latest: fires?.latestAcquisition ?? null,
    platform: "NOAA-20",
    ok: fires != null,
  });

  return { checkedAt: new Date().toISOString(), sensors, areas: AREAS.map((a) => a.id) };
}
