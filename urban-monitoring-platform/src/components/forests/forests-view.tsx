"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { Chart } from "react-chartjs-2";
import { ChartLine, Download, ExternalLink, Flame, Map as MapIcon, ShieldCheck, TreePine, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { fetcher, useCountries, useCountryFires, useCountryProfile, useCountryShape, useEoTiles } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { fmt, palette } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Flag } from "@/components/ui/flag";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { grid } from "@/components/charts/setup";
import { Combobox } from "@/components/location/combobox";
import { EoLegendView } from "@/components/eo/eo-legend";
import { PanelBoundary } from "@/components/ui/panel-boundary";

const ForestMapCanvas = dynamic(() => import("./forest-map-canvas"), { ssr: false, loading: () => <Skeleton className="size-full rounded-none" /> });

type RankRow = { iso2: string; name: string; from: { year: number; value: number }; to: { year: number; value: number }; changeKm2: number; changePct: number };
type Ranking = { fetchedAt: string; apiUrl: string; countries: number; losses: RankRow[]; gains: RankRow[] };

const nf = new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 });

function RankList({ rows, tone, active, onPick }: { rows: RankRow[]; tone: "loss" | "gain"; active: string; onPick: (iso2: string) => void }) {
  return (
    <ol className="space-y-1">
      {rows.map((r, i) => (
        <li key={r.iso2}>
          <button
            type="button"
            onClick={() => onPick(r.iso2)}
            className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-surface-2", r.iso2 === active && "bg-surface-3")}
          >
            <span className="w-4 text-right font-mono text-subtle">{i + 1}</span>
            <Flag iso2={r.iso2.toLowerCase()} className="h-3 w-4" />
            <span className="min-w-0 flex-1 truncate">{r.name}</span>
            <span className={cn("font-mono", tone === "loss" ? "text-danger" : "text-ok")}>
              {r.changeKm2 > 0 ? "+" : ""}
              {nf.format(r.changeKm2)} km²
            </span>
            <span className="w-14 text-right font-mono text-subtle">
              {r.changePct > 0 ? "+" : ""}
              {r.changePct}%
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

export function ForestsView({ initialIso2 }: { initialIso2: string }) {
  const [iso2, setIso2] = useState(initialIso2);
  const [underlay, setUnderlay] = useState<"none" | "landcover">("landcover");
  const countries = useCountries();
  const profile = useCountryProfile(iso2);
  const shape = useCountryShape(iso2);
  const fires = useCountryFires(iso2);
  const ranking = useSWR<Ranking>("/api/forest/ranking", fetcher, { revalidateOnFocus: false });
  const end = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const eo = useEoTiles(underlay === "none" ? null : underlay, 60, end);

  const ind = profile.data?.indicators.indicators;
  const km2 = ind?.forestKm2.points ?? [];
  const pct = ind?.forestPct.points ?? [];
  const first = km2[0];
  const last = km2.length ? km2[km2.length - 1] : undefined;
  const since = first && last && first.value > 0 ? ((last.value - first.value) / first.value) * 100 : null;
  const tenAgo = last ? km2.find((p) => p.year === last.year - 10) : undefined;
  const perYear = last && tenAgo ? (last.value - tenAgo.value) / 10 : null;
  const name = profile.data?.country.name ?? countries.data?.countries.find((c) => c.iso2 === iso2)?.name ?? iso2;

  const countryItems = useMemo(
    () =>
      (countries.data?.countries ?? []).map((c) => ({
        value: c.iso2,
        label: c.name,
        hint: c.continent,
        icon: <Flag iso2={c.iso2.toLowerCase()} className="h-3.5 w-5" />,
      })),
    [countries.data],
  );

  return (
    <>
      <PageHeader
        title="Forests & fires"
        description="Forest cover for every country (World Bank / FAO), NASA VIIRS fires from the last 24 hours and ESA WorldCover land cover."
        actions={
          <a
            href={`/api/country/${iso2}/export`}
            download
            className="inline-flex items-center gap-2 rounded-lg border border-ok/30 bg-ok/10 px-3.5 py-2 text-xs font-semibold text-ok hover:bg-ok/20"
          >
            <Download className="size-4" aria-hidden /> Export data (CSV)
          </a>
        }
      />

      <Card className="relative z-20">
        <CardBody className="flex flex-col gap-4 pt-5 md:flex-row md:items-end">
          <Combobox
            label="Country"
            placeholder="Choose a country"
            items={countryItems}
            value={iso2}
            loading={countries.isLoading}
            onChange={setIso2}
            className="md:w-96"
          />
          {profile.data && (
            <div className="flex items-center gap-3 md:ml-4">
              <Flag iso2={iso2.toLowerCase()} className="h-8 w-11 rounded" />
              <div>
                <div className="text-lg font-semibold">{name}</div>
                <div className="text-xs text-muted">
                  {profile.data.country.continent} · {fmt.int(profile.data.country.areaKm2)} km² total area
                </div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {profile.error && !profile.data && (
        <Card>
          <ErrorState message={`World Bank statistics for ${name} are refreshing.`} onRetry={() => profile.mutate()} />
        </Card>
      )}
      {profile.data && !km2.length && (
        <Card>
          <ErrorState message={`The World Bank publishes no forest-area series for ${name}.`} />
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          icon={TreePine}
          tone="ok"
          label="Forest cover"
          value={ind?.forestPct.latest ? ind.forestPct.latest.value.toFixed(1) : "—"}
          unit="%"
          hint={ind?.forestPct.latest ? `of land area · ${ind.forestPct.latest.year}` : profile.isLoading ? undefined : "no data"}
          loading={profile.isLoading}
        />
        <StatCard
          icon={TreePine}
          tone="accent"
          label="Forest area"
          value={last ? nf.format(last.value) : "—"}
          unit="km²"
          hint={last ? String(last.year) : profile.isLoading ? undefined : "no data"}
          loading={profile.isLoading}
        />
        <StatCard
          icon={since != null && since < 0 ? TrendingDown : TrendingUp}
          tone={since != null && since < 0 ? "danger" : "ok"}
          label={first ? `Change since ${first.year}` : "Long-term change"}
          value={since != null ? fmt.signedPct(since) : "—"}
          valueColor={since == null ? undefined : since < 0 ? "#f43f5e" : "#34d399"}
          hint={first && last ? `${nf.format(last.value - first.value)} km²` : undefined}
          loading={profile.isLoading}
        />
        <StatCard
          icon={ChartLine}
          tone="warn"
          label="Last 10 years"
          value={perYear != null ? `${perYear > 0 ? "+" : ""}${nf.format(perYear)}` : "—"}
          unit="km²/yr"
          hint="Average annual net change"
          loading={profile.isLoading}
        />
        <StatCard
          icon={ShieldCheck}
          tone="violet"
          label="Protected land"
          value={ind?.protectedPct.latest ? ind.protectedPct.latest.value.toFixed(1) : "—"}
          unit="%"
          hint={ind?.protectedPct.latest ? `terrestrial · ${ind.protectedPct.latest.year}` : profile.isLoading ? undefined : "no data"}
          loading={profile.isLoading}
        />
        <StatCard
          icon={Flame}
          tone="alert"
          label="Active fires · 24 h"
          value={profile.data?.fires ? fmt.int(profile.data.fires.last24h) : fires.data ? fmt.int(fires.data.meta.total) : "—"}
          hint={profile.data?.fires ? `${profile.data.fires.highFrp} intense · ${profile.data.fires.night} at night` : "NASA FIRMS VIIRS"}
          loading={profile.isLoading && !fires.data}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader
            icon={ChartLine}
            title={`Forest area in ${name}`}
            subtitle="Annual estimates, km² (bars) and % of land area (line)"
            action={
              ind && (
                <a href={ind.forestKm2.verifyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline">
                  Verify on World Bank <ExternalLink className="size-3" aria-hidden />
                </a>
              )
            }
          />
          <CardBody className="h-80">
            {km2.length ? (
              <Chart
                type="bar"
                data={{
                  labels: km2.map((p) => p.year),
                  datasets: [
                    {
                      type: "bar",
                      label: "Forest area (km²)",
                      data: km2.map((p) => p.value),
                      backgroundColor: "rgba(52,211,153,0.55)",
                      borderRadius: 3,
                      yAxisID: "y",
                      order: 2,
                    },
                    {
                      type: "line",
                      label: "% of land area",
                      data: km2.map((p) => pct.find((q) => q.year === p.year)?.value ?? null),
                      borderColor: palette.warn,
                      borderWidth: 2,
                      pointRadius: 0,
                      tension: 0.3,
                      yAxisID: "y1",
                      order: 1,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: { mode: "index", intersect: false },
                  plugins: { legend: { position: "top", align: "end" } },
                  scales: {
                    x: { grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 12 } },
                    y: { grid, border: { display: false }, ticks: { callback: (v) => nf.format(Number(v)) }, title: { display: true, text: "km²" } },
                    y1: { position: "right", grid: { display: false }, border: { display: false }, title: { display: true, text: "%" } },
                  },
                }}
              />
            ) : profile.isLoading ? (
              <Skeleton className="size-full" />
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted">No forest time series available.</div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={Trophy}
            title="Forest change since 2000"
            subtitle={ranking.data ? `${ranking.data.countries} countries · click to explore` : "World Bank / FAO"}
          />
          <CardBody className="space-y-4">
            {!ranking.data ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <>
                <div>
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-danger">
                    <TrendingDown className="size-3.5" aria-hidden /> Largest losses
                  </div>
                  <RankList rows={ranking.data.losses.slice(0, 6)} tone="loss" active={iso2} onPick={setIso2} />
                </div>
                <div>
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ok">
                    <TrendingUp className="size-3.5" aria-hidden /> Largest gains
                  </div>
                  <RankList rows={ranking.data.gains.slice(0, 6)} tone="gain" active={iso2} onPick={setIso2} />
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          icon={MapIcon}
          title={`Fires and land cover — ${name}`}
          subtitle={
            fires.data
              ? `${fmt.int(fires.data.meta.total)} VIIRS detections in the last 24 h${fires.data.meta.total > 5000 ? " (strongest 5,000 shown)" : ""}`
              : "Loading NASA FIRMS…"
          }
          action={
            <Segmented
              label="Underlay"
              size="xs"
              value={underlay}
              onChange={setUnderlay}
              options={[
                { value: "landcover", label: "ESA land cover" },
                { value: "none", label: "None" },
              ]}
            />
          }
        />
        <CardBody>
          <div className="relative h-[480px] overflow-hidden rounded-xl border border-line">
            <PanelBoundary label="The map" className="size-full">
              <ForestMapCanvas
                shape={shape.data}
                fires={fires.data}
                underlay={
                  eo.data
                    ? { url: eo.data.tileUrl, maxNativeZoom: eo.data.maxNativeZoom, minZoom: eo.data.layer.minZoom ?? 0, attribution: eo.data.layer.attribution }
                    : null
                }
              />
            </PanelBoundary>
            {eo.data?.layer.legend && underlay !== "none" && (
              <div className="absolute bottom-3 left-3 z-[1000] w-64 rounded-xl border border-line-strong bg-surface/95 p-3 backdrop-blur">
                <div className="mb-1.5 text-[11px] font-semibold">ESA WorldCover 2021 (10 m)</div>
                <EoLegendView legend={eo.data.layer.legend} compact />
                <div className="mt-2 flex items-center gap-2 border-t border-line pt-1.5 text-[10px] text-muted">
                  <span className="size-2 rounded-full bg-[#fbbf24]" /> fire
                  <span className="size-2 rounded-full bg-[#f43f5e]" /> intense fire (≥20 MW)
                </div>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {profile.data && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-subtle">
          <span>Sources:</span>
          <a href={profile.data.indicators.apiUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
            World Bank WDI API
          </a>
          {profile.data.fires && (
            <a href={profile.data.fires.source} target="_blank" rel="noreferrer" className="text-accent hover:underline">
              NASA FIRMS VIIRS (NOAA-20) 24 h
            </a>
          )}
          <span>ESA WorldCover via Microsoft Planetary Computer</span>
          <Badge>
            Fires updated {profile.data.fires ? new Date(profile.data.fires.fetchedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—"}
          </Badge>
        </div>
      )}
    </>
  );
}
