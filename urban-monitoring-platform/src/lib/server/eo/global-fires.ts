import "server-only";
import { cacheLife } from "next/cache";
import { ApiError, asUpstreamError } from "../http";
import { countryAt } from "../geo";

/** NASA FIRMS global VIIRS 375 m detections, last 24 h (NOAA-20), public NRT file — no key. */
export const FIRMS_GLOBAL_URL = "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_24h.csv";

/** Compact detection: [lat, lng, frp MW, acquired ISO, night]. */
export type FireRow = [number, number, number, string, boolean];

export interface GlobalFires {
  fetchedAt: string;
  latestAcquisition: string | null;
  total: number;
  byCountry: Record<string, FireRow[]>;
}

export async function getGlobalFires(): Promise<GlobalFires> {
  "use cache";
  cacheLife({ stale: 600, revalidate: 3600, expire: 21600 });

  let csv: string;
  try {
    const res = await fetch(FIRMS_GLOBAL_URL, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new ApiError(502, `NASA FIRMS responded with ${res.status}`);
    csv = await res.text();
  } catch (err) {
    throw asUpstreamError(err, "NASA FIRMS");
  }

  const lines = csv.split(/\r?\n/);
  const head = lines[0].split(",");
  const [iLat, iLng, iFrp, iDate, iTime, iDn] = ["latitude", "longitude", "frp", "acq_date", "acq_time", "daynight"].map((c) => head.indexOf(c));
  const byCountry: Record<string, FireRow[]> = {};
  let latest: string | null = null;
  let total = 0;
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",");
    if (c.length < head.length) continue;
    const lat = Number(c[iLat]);
    const lng = Number(c[iLng]);
    const iso2 = countryAt(lng, lat);
    if (!iso2) continue; // ocean / gas platforms
    const t = c[iTime].padStart(4, "0");
    const acquired = `${c[iDate]}T${t.slice(0, 2)}:${t.slice(2)}:00Z`;
    if (!latest || acquired > latest) latest = acquired;
    (byCountry[iso2] ??= []).push([lat, lng, Number(c[iFrp]) || 0, acquired, c[iDn] === "N"]);
    total++;
  }
  return { fetchedAt: new Date().toISOString(), latestAcquisition: latest, total, byCountry };
}
