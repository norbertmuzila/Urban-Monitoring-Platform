import { connection } from "next/server";
import { handle, json } from "@/lib/server/http";
import { CHIPINGE_DISTRICT_IDS, CHIPINGE_SITES, CHIPINGE_TOWN, chipingeOutline } from "@/lib/server/eo/chipinge";
import { getZimbabweFires } from "@/lib/server/eo/firms";
import { DISTRICTS_META } from "@/lib/server/eo/zimbabwe";

/** GET /api/chipinge — observatory overview: official outline, monitoring sites, VIIRS fires (24 h). */
export const GET = handle(async () => {
  await connection(); // live fire data
  const outline = chipingeOutline();
  // Fires must not hold the page on a cold cache: 3 s, then they keep loading in the background.
  const fires = await Promise.race([getZimbabweFires(), new Promise<null>((r) => setTimeout(() => r(null), 3000))]).catch(() => null);
  const inDistrict = fires?.last24h.filter((f) => (CHIPINGE_DISTRICT_IDS as readonly string[]).includes(f.district)) ?? null;
  const counts = CHIPINGE_DISTRICT_IDS.map((id) => fires?.byDistrict[id]);
  return json(
    {
      town: CHIPINGE_TOWN,
      areaKm2: outline.areaKm2,
      bbox: outline.bbox,
      outline: { type: "Feature", properties: { name: "Chipinge District", source: DISTRICTS_META.source }, geometry: outline.geometry },
      sites: CHIPINGE_SITES,
      fires: fires
        ? {
            last24h: inDistrict!.map(({ lat, lng, frp, acquired, night }) => ({ lat, lng, frp, acquired, night })),
            last7d: counts.reduce((s, c) => s + (c?.last7d ?? 0), 0),
            night7d: counts.reduce((s, c) => s + (c?.night7d ?? 0), 0),
            latestAcquisition: fires.latestAcquisition,
          }
        : null,
    },
    { sMaxAge: 900, staleWhileRevalidate: 3600 },
  );
});
