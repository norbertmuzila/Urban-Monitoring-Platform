import "server-only";
import { cacheLife } from "next/cache";
import { ApiError, asUpstreamError } from "./http";

/** World Bank World Development Indicators used for country profiles (all open, CC BY 4.0). */
export const WB_INDICATORS = {
  population: { id: "SP.POP.TOTL", label: "Population", unit: "people" },
  urbanPct: { id: "SP.URB.TOTL.IN.ZS", label: "Urban population", unit: "% of total" },
  pm25: { id: "EN.ATM.PM25.MC.M3", label: "PM2.5 mean annual exposure", unit: "µg/m³" },
  forestPct: { id: "AG.LND.FRST.ZS", label: "Forest area", unit: "% of land" },
  forestKm2: { id: "AG.LND.FRST.K2", label: "Forest area", unit: "km²" },
  protectedPct: { id: "ER.LND.PTLD.ZS", label: "Terrestrial protected areas", unit: "% of land" },
  co2PerCapita: { id: "EN.GHG.CO2.PC.CE.AR5", label: "CO₂ emissions per capita", unit: "t CO₂e" },
  gdpPerCapita: { id: "NY.GDP.PCAP.CD", label: "GDP per capita", unit: "current US$" },
} as const;

export type IndicatorKey = keyof typeof WB_INDICATORS;

export interface IndicatorSeries {
  key: IndicatorKey;
  id: string;
  label: string;
  unit: string;
  /** Ascending by year, only years with values. */
  points: { year: number; value: number }[];
  latest: { year: number; value: number } | null;
  /** Human-checkable source page for this exact indicator and country. */
  verifyUrl: string;
}

export interface CountryIndicators {
  iso3: string;
  fetchedAt: string;
  indicators: Record<IndicatorKey, IndicatorSeries>;
  apiUrl: string;
}

type WbRow = { indicator: { id: string }; date: string; value: number | null };

export async function getCountryIndicators(iso3: string): Promise<CountryIndicators> {
  "use cache";
  // WDI updates a few times a year.
  cacheLife("days");
  const ids = Object.values(WB_INDICATORS).map((i) => i.id);
  const apiUrl = `https://api.worldbank.org/v2/country/${iso3}/indicator/${ids.join(";")}?source=2&format=json&date=1990:2030&per_page=2000`;

  // The WDI API is occasionally slow or returns transient errors: one retry.
  let body: unknown;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new ApiError(502, `World Bank responded with ${res.status}`);
      body = await res.json();
      break;
    } catch (err) {
      if (attempt >= 2) throw asUpstreamError(err, "World Bank");
    }
  }
  // Unknown economies return [{ message: [...] }].
  const rows = Array.isArray(body) && Array.isArray(body[1]) ? (body[1] as WbRow[]) : [];

  const indicators = {} as Record<IndicatorKey, IndicatorSeries>;
  for (const [key, meta] of Object.entries(WB_INDICATORS) as [IndicatorKey, (typeof WB_INDICATORS)[IndicatorKey]][]) {
    const points = rows
      .filter((r) => r.indicator.id === meta.id && r.value != null)
      .map((r) => ({ year: Number(r.date), value: r.value as number }))
      .sort((a, b) => a.year - b.year);
    indicators[key] = {
      key,
      ...meta,
      points,
      latest: points.at(-1) ?? null,
      verifyUrl: `https://data.worldbank.org/indicator/${meta.id}?locations=${iso3}`,
    };
  }
  return { iso3, fetchedAt: new Date().toISOString(), indicators, apiUrl };
}
