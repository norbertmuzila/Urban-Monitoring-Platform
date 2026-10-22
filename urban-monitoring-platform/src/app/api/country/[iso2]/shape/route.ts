import { ApiError, handle, json } from "@/lib/server/http";
import { getCountry, getCountryShape, GEO_SOURCES } from "@/lib/server/geo";

/** GET /api/country/:iso2/shape — simplified outline (Natural Earth 1:50m). */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/country/[iso2]/shape">) => {
  const { iso2 } = await ctx.params;
  const country = getCountry(iso2);
  if (!country) throw new ApiError(404, `Unknown country '${iso2}'`);
  const shape = getCountryShape(country.iso2);
  return json(
    { type: "Feature", properties: { iso2: country.iso2, name: country.name, source: GEO_SOURCES.shapes }, bbox: shape?.bbox ?? country.bbox, geometry: shape?.geometry ?? null },
    { sMaxAge: 86400 },
  );
});
