import { ApiError, handle, json } from "@/lib/server/http";
import { placeById } from "@/lib/server/geo";

/** GET /api/geo/places/:id — a GeoNames place (≥1,000 people) by id, for shared links. */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/geo/places/[id]">) => {
  const { id } = await ctx.params;
  const n = Number(id);
  const place = Number.isInteger(n) && n > 0 ? placeById(n) : null;
  if (!place) throw new ApiError(404, `Unknown place '${id}'`);
  return json(place, { sMaxAge: 86400 });
});
