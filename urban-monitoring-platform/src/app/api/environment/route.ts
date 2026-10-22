import { z } from "zod";
import { coords, handle, json, parseQuery } from "@/lib/server/http";
import { getEnvironment } from "@/lib/server/open-meteo";

const Query = z.object(coords);

/** GET /api/environment?lat=&lng= — current air quality, weather and the last 24 h of observations. */
export const GET = handle(async (request: Request) => {
  const { lat, lng } = parseQuery(request, Query);
  return json(await getEnvironment(lat, lng), { sMaxAge: 300, staleWhileRevalidate: 600 });
});
