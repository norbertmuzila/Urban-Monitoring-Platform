import { connection } from "next/server";
import { ApiError, handle, json } from "@/lib/server/http";
import { analyzeSite, getChipingeSite } from "@/lib/server/eo/chipinge";
import { todayUtc } from "@/lib/server/eo/layers";

export const maxDuration = 120;

/** GET /api/chipinge/sites/:id — Sentinel-2/Sentinel-1 change at one monitoring site, this season vs last year. */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/chipinge/sites/[id]">) => {
  await connection();
  const { id } = await ctx.params;
  const site = getChipingeSite(id);
  if (!site) throw new ApiError(404, `Unknown site '${id}'`);
  return json(await analyzeSite(site, todayUtc()), { sMaxAge: 3600, staleWhileRevalidate: 21600 });
});
