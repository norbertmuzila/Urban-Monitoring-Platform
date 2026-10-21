import { ApiError, asUpstreamError, handle } from "@/lib/server/http";
import { getCountry } from "@/lib/server/geo";
import { getCountryIndicators, WB_INDICATORS } from "@/lib/server/worldbank";

const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** GET /api/country/:iso2/export — World Bank indicator time series as CSV (one row per year). */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/country/[iso2]/export">) => {
  const { iso2 } = await ctx.params;
  const country = getCountry(iso2);
  if (!country) throw new ApiError(404, `Unknown country '${iso2}'`);
  let data;
  try {
    data = await getCountryIndicators(country.iso3);
  } catch (err) {
    throw asUpstreamError(err, "World Bank");
  }
  const keys = Object.keys(WB_INDICATORS) as (keyof typeof WB_INDICATORS)[];
  const years = [...new Set(keys.flatMap((k) => data.indicators[k].points.map((p) => p.year)))].sort();
  const lines = [
    [`${country.name} — World Bank World Development Indicators (CC BY 4.0)`],
    [`Retrieved ${data.fetchedAt}`, data.apiUrl],
    [],
    ["Year", ...keys.map((k) => `${WB_INDICATORS[k].label} (${WB_INDICATORS[k].unit}) [${WB_INDICATORS[k].id}]`)],
    ...years.map((y) => [y, ...keys.map((k) => data.indicators[k].points.find((p) => p.year === y)?.value ?? "")]),
  ];
  return new Response(lines.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${country.iso3}_indicators_worldbank.csv"`,
      "Cache-Control": "public, max-age=0, s-maxage=86400",
    },
  });
});
