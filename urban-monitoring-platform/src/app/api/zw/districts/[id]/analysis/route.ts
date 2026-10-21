import { connection } from "next/server";
import { z } from "zod";
import { ApiError, handle, json, parseQuery } from "@/lib/server/http";
import { analyzeDistrict } from "@/lib/server/eo/district-analysis";
import { todayUtc } from "@/lib/server/eo/layers";
import { getDistrict } from "@/lib/server/eo/zimbabwe";

export const maxDuration = 120;

const Query = z.object({ format: z.enum(["json", "geojson"]).default("json") });

/**
 * GET /api/zw/districts/:id/analysis[?format=geojson] — year-on-year satellite screening
 * for one district (Sentinel-2, Sentinel-1, VIIRS). Results are cached per day.
 */
export const GET = handle(async (request: Request, ctx: RouteContext<"/api/zw/districts/[id]/analysis">) => {
  await connection();
  const { id } = await ctx.params;
  const { format } = parseQuery(request, Query);
  const district = getDistrict(id);
  if (!district) throw new ApiError(404, `Unknown district '${id}'`);

  const analysis = await analyzeDistrict(district, todayUtc());
  if (format === "json") return json(analysis, { sMaxAge: 3600, staleWhileRevalidate: 21600 });

  const props = {
    district: analysis.district.name,
    generatedAt: analysis.generatedAt,
    screeningScore: analysis.screening.score,
    screeningLevel: analysis.screening.level,
    ...Object.fromEntries(analysis.indicators.flatMap((i) => [[`${i.id}_current`, i.current], [`${i.id}_baseline`, i.baseline], [`${i.id}_delta`, i.delta]])),
    fires7d: analysis.fires.last7d,
    mappedMiningSites: analysis.miningSites.count,
    caveat: analysis.caveats[0],
  };
  return new Response(JSON.stringify({ type: "Feature", properties: props, geometry: district.geometry }), {
    headers: {
      "Content-Type": "application/geo+json",
      "Content-Disposition": `attachment; filename="screening_${district.id}_${analysis.generatedAt.slice(0, 10)}.geojson"`,
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
});
