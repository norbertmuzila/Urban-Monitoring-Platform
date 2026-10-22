import { connection } from "next/server";
import { asUpstreamError, handle, json } from "@/lib/server/http";
import { getSensorStatus } from "@/lib/server/eo/status";

/** GET /api/eo/status — latest real acquisition per sensor over the study areas. */
export const GET = handle(async () => {
  await connection(); // depends on live upstreams: never prerender at build time
  try {
    return json(await getSensorStatus(), { sMaxAge: 600 });
  } catch (err) {
    throw asUpstreamError(err, "Sensor status");
  }
});
