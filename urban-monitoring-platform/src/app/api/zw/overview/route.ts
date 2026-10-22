import { connection } from "next/server";
import { asUpstreamError, handle, json } from "@/lib/server/http";
import { getZimbabweFires } from "@/lib/server/eo/firms";
import { DISTRICTS, DISTRICTS_META, MINING_SITES, MINING_SITES_META } from "@/lib/server/eo/zimbabwe";

/** GET /api/zw/overview — national per-district fire activity and mapped mining sites. */
export const GET = handle(async () => {
  await connection(); // depends on live upstreams: never prerender at build time
  let fires;
  try {
    fires = await getZimbabweFires();
  } catch (err) {
    throw asUpstreamError(err, "NASA FIRMS");
  }
  const sites: Record<string, number> = {};
  for (const s of MINING_SITES) sites[s.district] = (sites[s.district] ?? 0) + 1;

  const districts = DISTRICTS.map((d) => {
    const f = fires.byDistrict[d.id] ?? { last24h: 0, last7d: 0, frp7d: 0, night7d: 0 };
    return {
      id: d.id,
      name: d.name,
      urban: d.urban,
      areaKm2: d.areaKm2,
      centroid: d.centroid,
      bbox: d.bbox,
      miningSites: sites[d.id] ?? 0,
      fires24h: f.last24h,
      fires7d: f.last7d,
      night7d: f.night7d,
      firesPer1000km2: Math.round((f.last7d / d.areaKm2) * 10000) / 10,
    };
  });

  return json(
    {
      districts,
      totals: { districts: DISTRICTS.length, miningSites: MINING_SITES.length, ...fires.totals },
      firms: { fetchedAt: fires.fetchedAt, latestAcquisition: fires.latestAcquisition, source: "NASA FIRMS VIIRS 375 m NRT (NOAA-20)" },
      sources: { districts: DISTRICTS_META, miningSites: MINING_SITES_META },
    },
    { sMaxAge: 900, staleWhileRevalidate: 3600 },
  );
});
