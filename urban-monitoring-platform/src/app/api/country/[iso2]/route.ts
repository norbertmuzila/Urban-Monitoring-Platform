import { ApiError, asUpstreamError, handle, json } from "@/lib/server/http";
import { getGlobalFires, FIRMS_GLOBAL_URL } from "@/lib/server/eo/global-fires";
import { getCountry, GEO_SOURCES } from "@/lib/server/geo";
import { getCountryIndicators } from "@/lib/server/worldbank";

/** GET /api/country/:iso2 — country profile: World Bank indicators + live VIIRS fire activity. */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/country/[iso2]">) => {
  const { iso2 } = await ctx.params;
  const country = getCountry(iso2);
  if (!country) throw new ApiError(404, `Unknown country '${iso2}'`);
  const { states, ...info } = country;

  const [indicators, fires] = await Promise.all([
    getCountryIndicators(country.iso3).catch((err) => {
      throw asUpstreamError(err, "World Bank");
    }),
    // Fire data must not hold up the profile on a cold cache: give it 3 s, then let it
    // finish filling the cache in the background.
    Promise.race([getGlobalFires(), new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))]).catch(() => null),
  ]);
  const detections = fires?.byCountry[country.iso2] ?? [];

  return json(
    {
      country: { ...info, stateCount: states.length },
      indicators,
      fires: fires
        ? {
            last24h: detections.length,
            night: detections.filter((d) => d[4]).length,
            highFrp: detections.filter((d) => d[2] >= 20).length,
            latestAcquisition: fires.latestAcquisition,
            fetchedAt: fires.fetchedAt,
            source: FIRMS_GLOBAL_URL,
          }
        : null,
      sources: GEO_SOURCES,
    },
    { sMaxAge: 1800, staleWhileRevalidate: 7200 },
  );
});
