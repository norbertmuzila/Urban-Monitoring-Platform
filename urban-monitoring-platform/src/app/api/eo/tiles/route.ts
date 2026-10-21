import { handle, json, parseQuery } from "@/lib/server/http";
import { resolveLayer } from "@/lib/server/eo/layers";
import { LayerWindowQuery } from "@/lib/server/eo/query";

/** GET /api/eo/tiles?layer=&days=&end= — tile template for a live satellite layer and time window. */
export const GET = handle(async (request: Request) => {
  const { layer, days, end } = parseQuery(request, LayerWindowQuery);
  return json(await resolveLayer(layer, end, days), { sMaxAge: 3600, staleWhileRevalidate: 21600 });
});
