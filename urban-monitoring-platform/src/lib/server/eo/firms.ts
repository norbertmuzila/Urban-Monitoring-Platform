import "server-only";
import { cacheLife } from "next/cache";
import { ApiError } from "../http";
import { districtAt, ZIMBABWE_BBOX } from "./zimbabwe";
import { inBBox } from "@/lib/geo";

/**
 * NASA FIRMS VIIRS 375 m active-fire detections (NOAA-20), public regional NRT files —
 * no MAP_KEY needed. Southern Africa covers Zimbabwe.
 */
const FIRMS_BASE = "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv";

export interface FireDetection {
  lat: number;
  lng: number;
  /** Fire radiative power, MW. */
  frp: number;
  confidence: "low" | "nominal" | "high";
  acquired: string;
  night: boolean;
  district: string;
}

export interface ZimbabweFires {
  fetchedAt: string;
  latestAcquisition: string | null;
  last24h: FireDetection[];
  byDistrict: Record<string, { last24h: number; last7d: number; frp7d: number; night7d: number }>;
  totals: { last24h: number; last7d: number };
}

const CONFIDENCE: Record<string, FireDetection["confidence"]> = { l: "low", low: "low", n: "nominal", nominal: "nominal", h: "high", high: "high" };

async function downloadCsv(window: "24h" | "7d") {
  let res: Response;
  try {
    res = await fetch(`${FIRMS_BASE}/J1_VIIRS_C2_Southern_Africa_${window}.csv`, { signal: AbortSignal.timeout(45_000) });
  } catch (err) {
    throw new ApiError(502, "NASA FIRMS is unreachable", String(err));
  }
  if (!res.ok) throw new ApiError(502, `NASA FIRMS responded with ${res.status}`);
  return res.text();
}

function parse(csv: string): FireDetection[] {
  const lines = csv.split(/\r?\n/); // FIRMS files use CRLF line endings
  const head = lines[0].split(",");
  const col = (name: string) => head.indexOf(name);
  const [iLat, iLng, iFrp, iConf, iDate, iTime, iDn] = ["latitude", "longitude", "frp", "confidence", "acq_date", "acq_time", "daynight"].map(col);
  const out: FireDetection[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",");
    if (c.length < head.length) continue;
    const lat = Number(c[iLat]);
    const lng = Number(c[iLng]);
    if (!inBBox(lng, lat, ZIMBABWE_BBOX)) continue;
    const district = districtAt(lng, lat);
    if (!district) continue;
    const t = c[iTime].padStart(4, "0");
    out.push({
      lat,
      lng,
      frp: Number(c[iFrp]) || 0,
      confidence: CONFIDENCE[c[iConf]] ?? "nominal",
      acquired: `${c[iDate]}T${t.slice(0, 2)}:${t.slice(2)}:00Z`,
      night: c[iDn] === "N",
      district: district.id,
    });
  }
  return out;
}

export async function getZimbabweFires(): Promise<ZimbabweFires> {
  "use cache";
  // FIRMS NRT updates every few hours.
  cacheLife({ stale: 600, revalidate: 3600, expire: 21600 });
  const [csv24, csv7] = await Promise.all([downloadCsv("24h"), downloadCsv("7d")]);
  const last24h = parse(csv24);
  const last7d = parse(csv7);

  const byDistrict: ZimbabweFires["byDistrict"] = {};
  const bump = (id: string) => (byDistrict[id] ??= { last24h: 0, last7d: 0, frp7d: 0, night7d: 0 });
  for (const f of last7d) {
    const d = bump(f.district);
    d.last7d++;
    d.frp7d += f.frp;
    if (f.night) d.night7d++;
  }
  for (const f of last24h) bump(f.district).last24h++;
  for (const d of Object.values(byDistrict)) d.frp7d = Math.round(d.frp7d);

  const latest = last7d.reduce<string | null>((m, f) => (!m || f.acquired > m ? f.acquired : m), null);
  return {
    fetchedAt: new Date().toISOString(),
    latestAcquisition: latest,
    last24h,
    byDistrict,
    totals: { last24h: last24h.length, last7d: last7d.length },
  };
}
