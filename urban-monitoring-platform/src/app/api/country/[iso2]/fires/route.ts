import { ApiError, asUpstreamError, handle, json } from "@/lib/server/http";
import { getGlobalFires, FIRMS_GLOBAL_URL } from "@/lib/server/eo/global-fires";
import { getCountry } from "@/lib/server/geo";

/** GET /api/country/:iso2/fires — VIIRS detections in the country, last 24 h (GeoJSON, strongest 5,000). */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/country/[iso2]/fires">) => {
  const { iso2 } = await ctx.params;
  const country = getCountry(iso2);
  if (!country) throw new ApiError(404, `Unknown country '${iso2}'`);
  let fires;
  try {
    fires = await getGlobalFires();
  } catch (err) {
    throw asUpstreamError(err, "NASA FIRMS");
  }
  const rows = [...(fires.byCountry[country.iso2] ?? [])].sort((a, b) => b[2] - a[2]).slice(0, 5000);
  return json(
    {
      type: "FeatureCollection",
      meta: { country: country.name, total: fires.byCountry[country.iso2]?.length ?? 0, latestAcquisition: fires.latestAcquisition, source: FIRMS_GLOBAL_URL },
      features: rows.map(([lat, lng, frp, acquired, night]) => ({
        type: "Feature",
        properties: { frp, acquired, night },
        geometry: { type: "Point", coordinates: [lng, lat] },
      })),
    },
    { sMaxAge: 1800, staleWhileRevalidate: 7200 },
  );
});
