import { connection } from "next/server";
import { cacheLife } from "next/cache";
import { asUpstreamError, handle, json } from "@/lib/server/http";
import { COUNTRIES } from "@/lib/server/geo";

type WbRow = { countryiso3code: string; date: string; value: number | null };

const URL = "https://api.worldbank.org/v2/country/all/indicator/AG.LND.FRST.K2?format=json&date=2000:2030&per_page=20000";

/** Forest area change since 2000 for every country with data (World Bank / FAO FRA). */
async function forestChange() {
  "use cache";
  cacheLife("days");
  const res = await fetch(URL, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`World Bank responded with ${res.status}`);
  const body = (await res.json()) as [unknown, WbRow[] | null];
  const byIso3 = new Map<string, { year: number; value: number }[]>();
  for (const r of body[1] ?? []) {
    if (r.value == null) continue;
    byIso3.set(r.countryiso3code, [...(byIso3.get(r.countryiso3code) ?? []), { year: Number(r.date), value: r.value }]);
  }
  // Ranks sovereign countries only, so the count matches the 195 countries elsewhere on the platform.
  const rows = COUNTRIES.filter((c) => c.sovereign).flatMap((c) => {
    const pts = (byIso3.get(c.iso3) ?? []).sort((a, b) => a.year - b.year);
    const first = pts.find((p) => p.year === 2000);
    const last = pts.at(-1);
    if (!first || !last || last.year <= 2000 || first.value <= 0) return [];
    return [
      {
        iso2: c.iso2,
        name: c.name,
        from: first,
        to: last,
        changeKm2: Math.round(last.value - first.value),
        changePct: Math.round(((last.value - first.value) / first.value) * 1000) / 10,
      },
    ];
  });
  return { fetchedAt: new Date().toISOString(), apiUrl: URL, rows };
}

/** GET /api/forest/ranking — largest forest losses and gains since 2000. */
export const GET = handle(async () => {
  await connection(); // depends on live upstreams: never prerender at build time
  let data;
  try {
    data = await forestChange();
  } catch (err) {
    throw asUpstreamError(err, "World Bank");
  }
  const sorted = [...data.rows].sort((a, b) => a.changeKm2 - b.changeKm2);
  return json(
    {
      fetchedAt: data.fetchedAt,
      apiUrl: data.apiUrl,
      countries: data.rows.length,
      losses: sorted.slice(0, 10),
      gains: sorted.slice(-10).reverse(),
    },
    { sMaxAge: 86400 },
  );
});
