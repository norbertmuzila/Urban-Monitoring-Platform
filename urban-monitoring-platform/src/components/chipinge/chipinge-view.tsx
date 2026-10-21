"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CloudRain,
  Crosshair,
  Droplets,
  ExternalLink,
  Flame,
  LoaderCircle,
  MapPinned,
  Radar,
  Satellite,
  ShieldAlert,
  Telescope,
  Thermometer,
  TreePine,
  Wind,
} from "lucide-react";
import { useChipinge, useChipingeLandCover, useChipingeSites, useEnvironment, useEoTiles } from "@/lib/client/api";
import type { Location } from "@/lib/data/types";
import type { SiteAnalysis } from "@/lib/server/eo/chipinge";
import { cn } from "@/lib/cn";
import { fmt } from "@/lib/format";
import { compass } from "@/lib/weather";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Flag } from "@/components/ui/flag";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { BASEMAP_OPTIONS, type BasemapId } from "@/components/maps/basemaps";
import { EoLegendView } from "@/components/eo/eo-legend";
import { PredictionsPanel } from "@/components/monitor/predictions-panel";
import { DistrictPanel } from "@/components/zimbabwe/district-panel";
import { LandCoverCard } from "./land-cover-card";
import { SITE_STATUS } from "./site-status";

const ChipingeMapCanvas = dynamic(() => import("./chipinge-map-canvas"), { ssr: false, loading: () => <Skeleton className="size-full rounded-none" /> });

const UNDERLAYS = [
  { value: "none", label: "None" },
  { value: "truecolor", label: "Imagery" },
  { value: "ndvi", label: "NDVI" },
  { value: "bsi", label: "Bare soil" },
  { value: "s1-vh", label: "Radar" },
  { value: "landcover", label: "Land cover" },
];

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * Angström fire-danger index (used by fire services in Scandinavia and southern Africa):
 * I = RH/20 + (27 − T)/10. Lower values mean drier, more flammable conditions.
 */
function angstrom(t: number | null, rh: number | null) {
  if (t == null || rh == null) return null;
  const i = rh / 20 + (27 - t) / 10;
  const band = i < 2 ? { label: "Fire very likely", color: "#f43f5e" } : i < 2.5 ? { label: "Fire favourable", color: "#fb923c" } : i <= 4 ? { label: "Fire unfavourable", color: "#fbbf24" } : { label: "Fire unlikely", color: "#34d399" };
  return { value: Math.round(i * 100) / 100, ...band };
}

function SiteDetail({ a }: { a: SiteAnalysis }) {
  const st = SITE_STATUS[a.status];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <span className="size-2.5 rounded-full" style={{ background: st.color }} /> {st.label}
        </span>
        {a.fires24h > 0 && <Badge tone="danger">{a.fires24h} fire{a.fires24h > 1 ? "s" : ""} · 24 h</Badge>}
      </div>
      <p className="text-xs leading-relaxed text-muted">{a.site.context}</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] tracking-wider text-subtle uppercase">
            <th className="pb-1 font-medium">Indicator</th>
            <th className="pb-1 text-right font-medium">Now</th>
            <th className="pb-1 text-right font-medium">Last year</th>
            <th className="pb-1 text-right font-medium">Δ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {a.indicators.map((i) => {
            const dp = i.unit ? 1 : 3;
            const bad = i.delta != null && Math.abs(i.delta) >= (i.unit ? 0.3 : 0.01) && (i.concern === "increase" ? i.delta > 0 : i.delta < 0);
            const good = i.delta != null && Math.abs(i.delta) >= (i.unit ? 0.3 : 0.01) && !bad;
            return (
              <tr key={i.id}>
                <td className="py-1.5">{i.label}</td>
                <td className="py-1.5 text-right font-mono">{i.current?.toFixed(dp) ?? "—"}</td>
                <td className="py-1.5 text-right font-mono text-muted">{i.baseline?.toFixed(dp) ?? "—"}</td>
                <td className={cn("py-1.5 text-right font-mono", bad ? "text-danger" : good ? "text-ok" : "text-muted")}>
                  {i.delta == null ? "—" : `${i.delta > 0 ? "+" : ""}${i.delta.toFixed(dp)}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="space-y-1 text-[11px] text-muted">
        <div className="flex justify-between">
          <span className="inline-flex items-center gap-1">
            <Satellite className="size-3" aria-hidden /> Sentinel-2
          </span>
          <span className="font-mono">
            {a.optical.current ? fmtDate(a.optical.current.date) : "—"} vs {a.optical.baseline ? fmtDate(a.optical.baseline.date) : "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="inline-flex items-center gap-1">
            <Radar className="size-3" aria-hidden /> Sentinel-1
          </span>
          <span className="font-mono">
            {a.radar.current ? fmtDate(a.radar.current.date) : "—"} vs {a.radar.baseline ? fmtDate(a.radar.baseline.date) : "—"}
          </span>
        </div>
        <div className="text-subtle">
          Mean over a {a.site.radiusKm} km radius · same weeks one year apart · {a.optical.current ? `${a.optical.current.pixels.toLocaleString("en-GB")} px` : ""}
        </div>
      </div>
      <Link
        href={`/explorer?layer=ndvi&lat=${a.site.lat}&lng=${a.site.lng}&z=13`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20"
      >
        <ExternalLink className="size-3.5" aria-hidden /> Compare dates in the explorer
      </Link>
    </div>
  );
}

export function ChipingeView() {
  const { data, error, mutate } = useChipinge();
  const lc = useChipingeLandCover();
  const sites = useChipingeSites(data?.sites.map((s) => s.id));
  const [selected, setSelected] = useState<string | null>(null);
  const [underlay, setUnderlay] = useState("none");
  const [basemap, setBasemap] = useState<BasemapId>("satellite");
  const end = useMemo(() => (underlay === "none" ? "" : new Date().toISOString().slice(0, 10)), [underlay]);
  const eo = useEoTiles(underlay === "none" ? null : underlay, 60, end);

  const town: Location | null = useMemo(
    () => (data ? { id: data.town.id, name: data.town.name, state: "Manicaland", country: "Zimbabwe", iso2: "ZW", lat: data.town.lat, lng: data.town.lng, population: data.town.population } : null),
    [data],
  );
  const env = useEnvironment(town);
  const fire = angstrom(env.data?.temperature ?? null, env.data?.humidity ?? null);

  const lcLast = lc.data?.years.at(-1);
  const counts = { loss: 0, stable: 0, gain: 0 };
  for (const a of Object.values(sites.data ?? {})) if (a && a.status in counts) counts[a.status as keyof typeof counts]++;
  const sel = data?.sites.find((s) => s.id === selected) ?? null;
  const selAnalysis = selected ? sites.data?.[selected] : undefined;

  return (
    <>
      {/* ------------------------------------------------------------- header */}
      <div className="rounded-[var(--radius-card)] border border-ok/25 bg-gradient-to-br from-ok/[0.08] via-surface/80 to-surface/80 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-ok uppercase">
              <Telescope className="size-4" aria-hidden /> Featured project · Manicaland, Zimbabwe
            </div>
            <h1 className="mt-2 flex items-center gap-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              <Flag iso2="zw" className="h-6 w-9 rounded" /> Chipinge Deforestation Observatory
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Live satellite monitoring of forest and woodland change across Chipinge District — from Chirinda Forest at Mount Selinda to the macadamia
              highlands, the Cyclone Idai–scarred Rusitu valley and the Save lowveld. Every figure is computed from open Copernicus, NASA and ESA data and
              can be checked against its source.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone="ok" live>
                Sentinel-2 MSI 10 m
              </Badge>
              <Badge tone="accent">Sentinel-1 C-SAR</Badge>
              <Badge>Impact Observatory 10 m land cover</Badge>
              <Badge>NASA VIIRS fires</Badge>
              <Badge>Principal investigator: Norbert Muzila · EuroMoonMars</Badge>
            </div>
          </div>
          <a
            href="/api/chipinge/export"
            download
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-ok/30 bg-ok/10 px-3.5 py-2 text-xs font-semibold text-ok hover:bg-ok/20"
          >
            Export land-cover data (CSV)
          </a>
        </div>
      </div>

      {error && !data && (
        <Card>
          <ErrorState message="The observatory could not be loaded." onRetry={() => mutate()} />
        </Card>
      )}

      {/* ------------------------------------------------------ fire weather */}
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface/80 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted uppercase">
          <Flame className="size-4 text-alert" aria-hidden /> Live fire weather · Chipinge town
          {env.data && <span className="font-normal tracking-normal text-subtle normal-case">observed {env.data.observedAt.slice(11, 16)} local</span>}
        </div>
        {env.data ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Thermometer className="size-4 text-alert" aria-hidden /> <strong className="font-mono">{fmt.dp(env.data.temperature)}°C</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Droplets className="size-4 text-accent" aria-hidden /> <strong className="font-mono">{fmt.int(env.data.humidity)}%</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Wind className="size-4 text-sky" aria-hidden /> <strong className="font-mono">{fmt.dp(env.data.windSpeed)} km/h</strong> {compass(env.data.windDirection)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CloudRain className="size-4 text-violet" aria-hidden /> <strong className="font-mono">{fmt.dp(env.data.precipitation)} mm</strong>
            </span>
            {fire && (
              <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs" style={{ borderColor: `${fire.color}55`, color: fire.color }} title="Angström index = RH/20 + (27 − T)/10">
                {fire.label} · Angström {fire.value}
              </span>
            )}
          </div>
        ) : (
          <Skeleton className="h-6 w-96" />
        )}
      </div>

      {/* --------------------------------------------------------------- KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={MapPinned} tone="accent" label="District area" value={data ? fmt.int(data.areaKm2) : "—"} unit="km²" hint="ZIMSTAT · incl. Chipinge Urban" loading={!data} />
        <StatCard icon={TreePine} tone="ok" label={`Tree cover ${lcLast?.year ?? ""}`} value={lcLast ? fmt.int(lcLast.km2.Trees) : "—"} unit="km²" hint={lcLast ? `${((lcLast.shares.Trees ?? 0) * 100).toFixed(1)}% of district` : "10 m land cover"} loading={!lc.data && !lc.error} />
        <StatCard icon={Flame} tone="alert" label="VIIRS fires · 24 h" value={data?.fires ? data.fires.last24h.length : "—"} hint={data?.fires ? `${data.fires.last7d} in 7 days · ${data.fires.night7d} at night` : "NASA FIRMS"} loading={!data} />
        <StatCard icon={ShieldAlert} tone="danger" label="Sites with canopy loss" value={sites.data ? counts.loss : "—"} unit={sites.data ? `/ ${data?.sites.length}` : undefined} hint="Year-on-year, this season" loading={!!data && !sites.data} />
        <StatCard icon={TreePine} tone="ok" label="Sites greener" value={sites.data ? counts.gain : "—"} hint="NDVI up, bare soil down" loading={!!data && !sites.data} />
        <StatCard icon={Crosshair} tone="warn" label="Sites stable" value={sites.data ? counts.stable : "—"} hint="No significant change" loading={!!data && !sites.data} />
      </div>

      {/* ------------------------------------------------------- map + sites */}
      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented label="Satellite underlay" size="xs" value={underlay} onChange={setUnderlay} options={UNDERLAYS} />
            <Segmented label="Basemap" size="xs" value={basemap} onChange={setBasemap} options={BASEMAP_OPTIONS} />
          </div>
          <div className="relative h-[560px] overflow-hidden rounded-[var(--radius-card)] border border-line">
            {data ? (
              <ChipingeMapCanvas
                data={data}
                analyses={sites.data}
                selected={selected}
                onSelect={setSelected}
                basemap={basemap}
                underlay={eo.data ? { url: eo.data.tileUrl, maxNativeZoom: eo.data.maxNativeZoom, minZoom: eo.data.layer.minZoom ?? 0, attribution: eo.data.layer.attribution } : null}
              />
            ) : (
              <Skeleton className="size-full rounded-none" />
            )}
            <div className="absolute bottom-3 left-3 z-[1000] w-60 space-y-2 rounded-xl border border-line-strong bg-surface/95 p-3 text-[11px] shadow-lg backdrop-blur">
              {eo.data?.layer.legend ? (
                <>
                  <div className="font-semibold">{eo.data.layer.label}</div>
                  <EoLegendView legend={eo.data.layer.legend} compact />
                  {eo.data.layer.minZoom ? <div className="text-[10px] text-subtle">Renders from zoom {eo.data.layer.minZoom} — select a site to zoom in.</div> : null}
                </>
              ) : (
                <>
                  <div className="font-semibold">Monitoring sites</div>
                  {Object.entries(SITE_STATUS).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2 text-muted">
                      <span className="size-2.5 rounded-full" style={{ background: v.color }} /> {v.label}
                    </div>
                  ))}
                  <div className="flex items-center gap-2 border-t border-line pt-1.5 text-muted">
                    <span className="size-2.5 rounded-full bg-[#fb923c]" /> VIIRS fire, last 24 h
                  </div>
                  <div className="text-[10px] text-subtle">Dashed line: official district boundary</div>
                </>
              )}
            </div>
          </div>
        </div>

        <Card className="flex max-h-[620px] flex-col">
          <CardHeader
            icon={Crosshair}
            title={sel ? sel.name : "Monitoring sites"}
            subtitle={sel ? sel.theme : "This season vs the same weeks last year · click a site"}
            action={
              sel ? (
                <button type="button" onClick={() => setSelected(null)} className="rounded-md border border-line px-2 py-1 text-[11px] hover:bg-surface-2">
                  All sites
                </button>
              ) : (
                sites.isLoading && <LoaderCircle className="size-4 animate-spin text-subtle" aria-hidden />
              )
            }
          />
          <div className="flex-1 overflow-y-auto px-5 pb-5">
            {sel ? (
              selAnalysis ? (
                <SiteDetail a={selAnalysis} />
              ) : sites.isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ErrorState message="Satellite analysis for this site is not available right now." onRetry={() => sites.mutate()} />
              )
            ) : (
              <ul className="space-y-2">
                {data?.sites.map((s) => {
                  const a = sites.data?.[s.id];
                  const st = SITE_STATUS[a?.status ?? "insufficient-data"];
                  const ndvi = a?.indicators.find((i) => i.id === "ndvi");
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(s.id)}
                        className="w-full rounded-xl border border-l-[3px] border-line bg-surface-2/60 p-3 text-left transition-colors hover:bg-surface-2"
                        style={{ borderLeftColor: st.color }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold">{s.name}</span>
                          {a ? <span className="text-[10px] font-medium" style={{ color: st.color }}>{st.label}</span> : <Skeleton className="h-3 w-16" />}
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-subtle">
                          <span>{s.theme}</span>
                          {ndvi?.delta != null && (
                            <span className="font-mono">
                              NDVI {ndvi.current?.toFixed(2)} ({ndvi.delta > 0 ? "+" : ""}
                              {ndvi.delta.toFixed(2)})
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
                {!data && Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {/* ------------------------------------------- land cover + screening */}
      <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
        <LandCoverCard />
        <DistrictPanel id="chipinge" name="Chipinge District" />
      </div>

      {town && <PredictionsPanel location={town} />}

      {/* ------------------------------------------------------------ method */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={Telescope} title="How the observatory works" />
          <CardBody>
            <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-muted">
              <li>The district outline is the official ZIMSTAT boundary (Chipinge rural district + Chipinge Urban, {data ? fmt.int(data.areaKm2) : "…"} km²).</li>
              <li>For each site, the clearest Sentinel-2 pass of the last 45 days and the pass from the same weeks a year earlier are averaged over a buffer (NDVI, NDMI, BSI); Sentinel-1 VH backscatter is compared the same way.</li>
              <li>A site is flagged “canopy loss” when NDVI fell by ≥ 0.05 and bare soil (BSI) rose by ≥ 0.02 year-on-year.</li>
              <li>Land-cover composition comes from the annual Impact Observatory / Esri 10 m maps, 2017–2023.</li>
              <li>Fires are NASA VIIRS 375 m detections; fire weather uses the Angström index from live Open-Meteo observations.</li>
            </ol>
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={ShieldAlert} title="Reading the results" />
          <CardBody className="space-y-2 text-xs leading-relaxed text-muted">
            <p>Year-on-year comparisons remove the strong wet/dry seasonality, but a wetter or drier year still shifts every site together — look for sites that diverge from the rest.</p>
            <p>Buffer averages capture landscape change around each site; small clearings are best checked visually with the explorer&apos;s before/after swipe.</p>
            <p className="text-subtle">
              Data: Copernicus Sentinel-1/2 and ESA WorldCover via Microsoft Planetary Computer · Impact Observatory/Esri LULC (CC BY 4.0) · NASA FIRMS · Open-Meteo ·
              ZIMSTAT/geoBoundaries (CC BY 3.0 IGO).
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
