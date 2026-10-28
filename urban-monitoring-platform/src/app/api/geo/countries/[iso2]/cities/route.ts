import { z } from "zod";
import { ApiError, handle, json, parseQuery } from "@/lib/server/http";
import { citiesOf, getCountry, GEO_SOURCES } from "@/lib/server/geo";

const Query = z.object({ state: z.string().max(20).optional() });

/** GET /api/geo/countries/:iso2/cities[?state=] — populated places ≥ 1,000 people, largest first. */
export const GET = handle(async (request: Request, ctx: RouteContext<"/api/geo/countries/[iso2]/cities">) => {
  const { iso2 } = await ctx.params;
  const { state } = parseQuery(request, Query);
  const country = getCountry(iso2);
  if (!country) throw new ApiError(404, `Unknown country '${iso2}'`);
  if (state != null && !country.states.some((s) => s.code === state)) throw new ApiError(404, `Unknown state '${state}' in ${country.name}`);
  // Whole-country lists are capped; state lists are complete.
  const cities = citiesOf(country.iso2, state, state == null ? 400 : 20000);
  return json({ source: GEO_SOURCES.cities, cities }, { sMaxAge: 86400 });
});
