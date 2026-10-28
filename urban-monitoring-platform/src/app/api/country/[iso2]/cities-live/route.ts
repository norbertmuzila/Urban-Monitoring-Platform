import { ApiError, handle, json } from "@/lib/server/http";
import { citiesOf, getCountry } from "@/lib/server/geo";
import { getCurrentBatch } from "@/lib/server/open-meteo";

/** GET /api/country/:iso2/cities-live — live air quality & temperature for the country's 8 largest cities. */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/country/[iso2]/cities-live">) => {
  const { iso2 } = await ctx.params;
  const country = getCountry(iso2);
  if (!country) throw new ApiError(404, `Unknown country '${iso2}'`);
  const cities = citiesOf(country.iso2, undefined, 8);
  const live = cities.length
    ? await getCurrentBatch(cities.map((c) => c.lat.toFixed(2)).join(","), cities.map((c) => c.lng.toFixed(2)).join(","))
    : [];
  return json(
    {
      cities: cities.map((c, i) => ({
        id: c.id,
        name: c.name,
        state: c.state,
        population: c.population,
        lat: c.lat,
        lng: c.lng,
        ...live[i],
      })),
    },
    { sMaxAge: 600, staleWhileRevalidate: 1800 },
  );
});
