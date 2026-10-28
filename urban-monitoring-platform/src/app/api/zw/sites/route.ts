import { handle, json } from "@/lib/server/http";
import { MINING_SITES, MINING_SITES_META } from "@/lib/server/eo/zimbabwe";

/** GET /api/zw/sites — mapped quarries, mines and shafts (OpenStreetMap snapshot, GeoJSON). */
export const GET = handle(async () =>
  json(
    {
      type: "FeatureCollection",
      meta: MINING_SITES_META,
      features: MINING_SITES.map(({ lat, lng, ...p }) => ({ type: "Feature", id: p.id, properties: p, geometry: { type: "Point", coordinates: [lng, lat] } })),
    },
    { sMaxAge: 86400 },
  ),
);
