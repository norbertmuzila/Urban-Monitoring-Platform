import { ApiError, handle, json } from "@/lib/server/http";
import { citiesOf, getCountry } from "@/lib/server/geo";

/** GET /api/geo/countries/:iso2 — country with its states/provinces and largest cities. */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/geo/countries/[iso2]">) => {
  const { iso2 } = await ctx.params;
  const country = getCountry(iso2);
  if (!country) throw new ApiError(404, `Unknown country '${iso2}'`);
  return json({ country, largestCities: citiesOf(country.iso2, undefined, 12) }, { sMaxAge: 86400 });
});
