import { z } from "zod";
import { coords, handle, json, parseQuery } from "@/lib/server/http";
import { predictLocation } from "@/lib/server/model/predict";

export const maxDuration = 60;

const Query = z.object(coords);

/**
 * GET /api/predict?lat=&lng= — 72 h temperature and PM2.5 predictions from the background
 * models (trained per location on 92 days of data), with hold-out verification.
 */
export const GET = handle(async (request: Request) => {
  const { lat, lng } = parseQuery(request, Query);
  // ~1 km grid keeps one trained model per neighbourhood.
  return json(await predictLocation(lat.toFixed(2), lng.toFixed(2)), { sMaxAge: 1800, staleWhileRevalidate: 3600 });
});
