import { handle, json } from "@/lib/server/http";
import { DISTRICTS, DISTRICTS_META } from "@/lib/server/eo/zimbabwe";

/** GET /api/zw/districts — Zimbabwe ADM2 district boundaries as GeoJSON. */
export const GET = handle(async () =>
  json(
    {
      type: "FeatureCollection",
      meta: DISTRICTS_META,
      features: DISTRICTS.map(({ geometry, ...p }) => ({ type: "Feature", id: p.id, properties: p, geometry })),
    },
    { sMaxAge: 86400 },
  ),
);
