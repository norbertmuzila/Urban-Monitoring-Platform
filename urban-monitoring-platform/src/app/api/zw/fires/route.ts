import { connection } from "next/server";
import { asUpstreamError, handle, json } from "@/lib/server/http";
import { getZimbabweFires } from "@/lib/server/eo/firms";

/** GET /api/zw/fires — VIIRS active-fire detections in Zimbabwe, last 24 h (GeoJSON). */
export const GET = handle(async () => {
  await connection(); // depends on live upstreams: never prerender at build time
  let fires;
  try {
    fires = await getZimbabweFires();
  } catch (err) {
    throw asUpstreamError(err, "NASA FIRMS");
  }
  return json(
    {
      type: "FeatureCollection",
      meta: { source: "NASA FIRMS VIIRS 375 m NRT (NOAA-20)", latestAcquisition: fires.latestAcquisition, fetchedAt: fires.fetchedAt },
      features: fires.last24h.map(({ lat, lng, ...p }) => ({ type: "Feature", properties: p, geometry: { type: "Point", coordinates: [lng, lat] } })),
    },
    { sMaxAge: 900, staleWhileRevalidate: 3600 },
  );
});
