import { connection } from "next/server";
import { handle, json } from "@/lib/server/http";
import { EO_LAYERS } from "@/lib/eo/layers";
import { getGlobalFires } from "@/lib/server/eo/global-fires";
import { getSensorStatus } from "@/lib/server/eo/status";
import { COUNTRIES } from "@/lib/server/geo";

/** GET /api/stats — headline platform figures for the home page. */
export const GET = handle(async () => {
  await connection(); // depends on live upstreams: never prerender at build time
  // Don't hold the home page on a cold download: answer within 8 s while the caches keep filling.
  const within = <T,>(p: Promise<T>) => Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), 8000))]).catch(() => null);
  const [fires, sensors] = await Promise.all([within(getGlobalFires()), within(getSensorStatus())]);
  const complete = fires != null && (sensors?.sensors.length ?? 0) > 0;
  const fireCountries = fires ? Object.entries(fires.byCountry).sort((a, b) => b[1].length - a[1].length) : [];
  return json(
    {
      coverage: {
        countries: COUNTRIES.filter((c) => c.sovereign).length,
        territories: COUNTRIES.filter((c) => !c.sovereign).length,
        states: COUNTRIES.reduce((s, c) => s + c.states.length, 0),
        cities: COUNTRIES.reduce((s, c) => s + c.cityCount, 0),
        satelliteLayers: EO_LAYERS.length,
      },
      fires: fires
        ? {
            last24h: fires.total,
            countries: fireCountries.length,
            top: fireCountries.slice(0, 5).map(([iso2, rows]) => ({ iso2, name: COUNTRIES.find((c) => c.iso2 === iso2)?.name ?? iso2, count: rows.length })),
            latestAcquisition: fires.latestAcquisition,
          }
        : null,
      sensors: sensors?.sensors ?? [],
    },
    // A partial answer must not be edge-cached: the page polls until it is complete.
    complete ? { sMaxAge: 1800, staleWhileRevalidate: 7200 } : "no-store",
  );
});
