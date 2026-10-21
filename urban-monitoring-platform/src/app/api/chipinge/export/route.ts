import { connection } from "next/server";
import { handle } from "@/lib/server/http";
import { getChipingeLandCover, LULC_ORDER } from "@/lib/server/eo/chipinge";

const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** GET /api/chipinge/export — land-cover series as CSV. */
export const GET = handle(async () => {
  await connection();
  const lc = await getChipingeLandCover();
  const labels = LULC_ORDER.map((c) => c.label);
  const rows: (string | number)[][] = [
    ["Chipinge District, Zimbabwe — annual land cover (km²)"],
    [lc.source],
    [`District area ${lc.areaKm2} km² (ZIMSTAT ADM2, Chipinge + Chipinge Urban)`],
    [],
    ["Year", "Map item", ...labels.map((l) => `${l} (km²)`), ...labels.map((l) => `${l} (%)`)],
    ...lc.years.map((y) => [y.year, y.item, ...labels.map((l) => y.km2[l] ?? 0), ...labels.map((l) => Math.round((y.shares[l] ?? 0) * 1000) / 10)]),
  ];
  return new Response(rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="chipinge_land_cover_2017-2023.csv"',
      "Cache-Control": "public, max-age=0, s-maxage=86400",
    },
  });
});
