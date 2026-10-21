import { handle, json } from "@/lib/server/http";
import { COUNTRIES, GEO_SOURCES } from "@/lib/server/geo";

/** GET /api/geo/countries — every country and territory (GeoNames). */
export const GET = handle(async () =>
  json(
    {
      source: GEO_SOURCES.countries,
      countries: COUNTRIES.map(({ states, ...c }) => ({ ...c, stateCount: states.length })),
    },
    { sMaxAge: 86400 },
  ),
);
