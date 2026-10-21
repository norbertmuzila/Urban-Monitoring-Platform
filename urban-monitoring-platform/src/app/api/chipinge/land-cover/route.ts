import { connection } from "next/server";
import { handle, json } from "@/lib/server/http";
import { getChipingeLandCover, LULC_ORDER } from "@/lib/server/eo/chipinge";

/** GET /api/chipinge/land-cover — annual 10 m land-cover composition of Chipinge District, 2017–2023. */
export const GET = handle(async () => {
  await connection(); // computed from Planetary Computer on demand, then cached for weeks
  return json({ ...(await getChipingeLandCover()), classes: LULC_ORDER }, { sMaxAge: 86400, staleWhileRevalidate: 604800 });
});
