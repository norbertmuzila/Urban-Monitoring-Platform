import { connection } from "next/server";
import { handle, json } from "@/lib/server/http";
import { getRadarFrames } from "@/lib/server/rainviewer";

/** GET /api/radar — latest precipitation radar frames as Leaflet tile templates. */
export const GET = handle(async () => {
  await connection(); // depends on live upstreams: never prerender at build time
  return json({ frames: await getRadarFrames() }, { sMaxAge: 300 });
});
