"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ArrowUpDown, BookOpenCheck, Download, Flame, Layers, MapPinned, Pickaxe, Satellite, Search, ShieldAlert, Telescope } from "lucide-react";
import { useEoTiles, useZwDistrictShapes, useZwFires, useZwOverview, useZwSites, type ZwOverviewDistrict } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { BASEMAP_OPTIONS, type BasemapId } from "@/components/maps/basemaps";
import { DistrictPanel } from "./district-panel";

const ZwMapCanvas = dynamic(() => import("./zw-map-canvas"), { ssr: false, loading: () => <Skeleton className="size-full rounded-none" /> });

type Metric = "firesPer1000km2" | "fires24h" | "miningSites";

const METRICS: { value: Metric; label: string; unit: string; breaks: number[] }[] = [
  { value: "firesPer1000km2", label: "Fire density · 7 d", unit: "per 1,000 km²", breaks: [1, 3, 8, 15] },
  { value: "fires24h", label: "Fires · 24 h", unit: "detections", breaks: [1, 5, 15, 40] },
  { value: "miningSites", label: "Mapped mining sites", unit: "sites", breaks: [1, 3, 7, 12] },
];
const RAMP = ["#1e293b", "#7c2d12", "#c2410c", "#f97316", "#fdba74"];

const UNDERLAYS = [
  { value: "none", label: "None" },
  { value: "truecolor", label: "True colour" },
  { value: "bsi", label: "Bare soil (BSI)" },
  { value: "ndvi", label: "NDVI" },
  { value: "ndti", label: "River turbidity" },
  { value: "s1-vh", label: "Radar VH" },
];

const binOf = (v: number, breaks: number[]) => (v <= 0 ? 0 : breaks.findIndex((b) => v < b) === -1 ? 4 : breaks.findIndex((b) => v < b));

type SortKey = "name" | "areaKm2" | "fires7d" | "firesPer1000km2" | "night7d" | "miningSites";

function Th({
  k,
  sort,
  onSort,
  right,
  children,
}: {
  k: SortKey;
  sort: { key: SortKey; desc: boolean };
  onSort: (k: SortKey) => void;
  right?: boolean;
  children: React.ReactNode;
}) {
  const active = sort.key === k;
  return (
    <th className={cn("pb-2 font-medium", right && "text-right")} aria-sort={active ? (sort.desc ? "descending" : "ascending") : undefined}>
      <button type="button" onClick={() => onSort(k)} className={cn("inline-flex items-center gap-1 hover:text-fg", active && "text-fg")}>
        {children}
        <ArrowUpDown className="size-3" aria-hidden />
      </button>
    </th>
  );
}

export function ZimbabweView() {
  const { data: overview, error, mutate } = useZwOverview();
  const { data: shapes } = useZwDistrictShapes();
  const [metric, setMetric] = useState<Metric>("firesPer1000km2");
  const [showFires, setShowFires] = useState(true);
  const [showSites, setShowSites] = useState(true);
  const [underlay, setUnderlay] = useState("none");
  const [basemap, setBasemap] = useState<BasemapId>("dark");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "firesPer1000km2", desc: true });

  const fires = useZwFires(showFires);
  const sites = useZwSites(showSites);
  // Today's date is only needed once an underlay is chosen (keeps the page statically prerenderable).
  const underlayEnd = useMemo(() => (underlay === "none" ? "" : new Date().toISOString().slice(0, 10)), [underlay]);
  const eo = useEoTiles(underlay === "none" ? null : underlay, 60, underlayEnd);

  const byId = useMemo(() => new Map(overview?.districts.map((d) => [d.id, d])), [overview]);
  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  const m = METRICS.find((x) => x.value === metric)!;

  const colorOf = useCallback(
    (id: string) => {
      const d = byId.get(id);
      return d ? RAMP[binOf(d[metric], m.breaks)] : null;
    },
    [byId, metric, m.breaks],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (overview?.districts ?? []).filter((d) => !q || d.name.toLowerCase().includes(q));
    const dir = sort.desc ? -1 : 1;
    return [...list].sort((a, b) => (sort.key === "name" ? a.name.localeCompare(b.name) * dir : (a[sort.key] - b[sort.key]) * dir));
  }, [overview, query, sort]);

  const top = useMemo(() => [...(overview?.districts ?? [])].sort((a, b) => b.firesPer1000km2 - a.firesPer1000km2)[0], [overview]);

  const th = { sort, onSort: (k: SortKey) => setSort((s) => ({ key: k, desc: s.key === k ? !s.desc : k !== "name" })) };

  return (
    <>
      <PageHeader
        title="Zimbabwe land & mining watch"
        description="Screening of all 91 ZIMSTAT districts for land disturbance — artisanal mining, woodland clearing and river siltation — from live Sentinel-2, Sentinel-1 and VIIRS observations, with mapped mine sites for context."
        actions={
          <>
            <Badge tone="ok" live>
              FIRMS NRT
            </Badge>
            <a
              href="/api/zw/fires"
              download="zimbabwe_viirs_fires_24h.geojson"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
            >
              <Download className="size-3.5" aria-hidden /> Fires GeoJSON
            </a>
          </>
        }
      />

      <Link
        href="/chipinge"
        className="group flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-ok/25 bg-ok/[0.06] px-5 py-3 text-sm transition-colors hover:bg-ok/10"
      >
        <span className="flex items-center gap-2">
          <Telescope className="size-4 text-ok" aria-hidden />
          <strong>Chipinge Deforestation Observatory</strong>
          <span className="hidden text-muted sm:inline">— site-level monitoring, land-cover change and fire weather for Chipinge District</span>
        </span>
        <span className="text-ok transition-transform group-hover:translate-x-0.5">Open →</span>
      </Link>

      {error && !overview && (
        <Card>
          <ErrorState message={error.message} onRetry={() => mutate()} />
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={MapPinned} tone="accent" label="Districts monitored" value={overview?.totals.districts ?? "—"} hint="ZIMSTAT ADM2 · incl. urban councils" loading={!overview} />
        <StatCard icon={Flame} tone="alert" label="VIIRS fires · 24 h" value={overview?.totals.last24h.toLocaleString("en-GB") ?? "—"} hint={overview?.firms.latestAcquisition ? `Latest pass ${new Date(overview.firms.latestAcquisition).toLocaleString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} UTC` : "NOAA-20 375 m"} loading={!overview} />
        <StatCard icon={Flame} tone="danger" label="VIIRS fires · 7 days" value={overview?.totals.last7d.toLocaleString("en-GB") ?? "—"} hint={top ? `Densest: ${top.name} (${top.firesPer1000km2}/1,000 km²)` : undefined} loading={!overview} />
        <StatCard icon={Pickaxe} tone="warn" label="Mapped mining sites" value={overview?.totals.miningSites ?? "—"} hint="OpenStreetMap quarries, mines & shafts" loading={!overview} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented label="Choropleth metric" size="xs" value={metric} onChange={setMetric} options={METRICS.map(({ value, label }) => ({ value, label }))} />
            <Segmented label="Basemap" size="xs" value={basemap} onChange={setBasemap} options={BASEMAP_OPTIONS} />
          </div>
          <div className="relative h-[62dvh] min-h-[460px] overflow-hidden rounded-[var(--radius-card)] border border-line">
            <ZwMapCanvas
              basemap={basemap}
              shapes={shapes}
              colorOf={colorOf}
              selected={selected ? { id: selected.id, bbox: selected.bbox } : null}
              onSelect={setSelectedId}
              fires={showFires ? fires.data : undefined}
              sites={showSites ? sites.data : undefined}
              underlay={eo.data ? { url: eo.data.tileUrl, maxNativeZoom: eo.data.maxNativeZoom, minZoom: eo.data.layer.minZoom ?? 0, attribution: eo.data.layer.attribution } : null}
            />

            <div className="absolute top-3 right-3 z-[1000] w-52 space-y-1 rounded-xl border border-line-strong bg-surface/95 p-2.5 text-xs shadow-lg backdrop-blur">
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                <Layers className="size-3.5 text-accent" aria-hidden /> Layers
              </div>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-surface-2">
                <input type="checkbox" checked={showFires} onChange={(e) => setShowFires(e.target.checked)} className="accent-[var(--color-alert)]" />
                <Flame className="size-3.5 text-alert" aria-hidden /> VIIRS fires (24 h)
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-surface-2">
                <input type="checkbox" checked={showSites} onChange={(e) => setShowSites(e.target.checked)} className="accent-[var(--color-warn)]" />
                <Pickaxe className="size-3.5 text-warn" aria-hidden /> Mapped mine sites
              </label>
              <label className="mt-1 block border-t border-line px-1.5 pt-2 text-[11px] text-muted">
                <span className="flex items-center gap-1.5">
                  <Satellite className="size-3.5" aria-hidden /> Satellite underlay
                </span>
                <select
                  value={underlay}
                  onChange={(e) => setUnderlay(e.target.value)}
                  className="mt-1 w-full rounded-md border border-line bg-surface-2 px-2 py-1 text-xs text-fg"
                >
                  {UNDERLAYS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </label>
              {underlay !== "none" && eo.data?.layer.minZoom && (
                <p className="px-1.5 text-[10px] text-subtle">Visible from zoom {eo.data.layer.minZoom} — select a district to zoom in.</p>
              )}
            </div>

            <div className="absolute bottom-3 left-3 z-[1000] rounded-xl border border-line-strong bg-surface/95 p-3 text-[11px] shadow-lg backdrop-blur">
              <div className="mb-1.5 font-semibold">
                {m.label} <span className="font-normal text-subtle">({m.unit})</span>
              </div>
              <div className="flex items-center gap-1">
                {RAMP.map((c, i) => (
                  <div key={c} className="text-center">
                    <div className="h-2.5 w-9 rounded-sm" style={{ background: c }} />
                    <div className="mt-0.5 font-mono text-[9px] text-subtle">{i === 0 ? "0" : `${m.breaks[i - 1]}+`}</div>
                  </div>
                ))}
              </div>
              {(showFires || showSites) && (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-line pt-1.5 text-[10px] text-muted">
                  {showFires && (
                    <span className="inline-flex items-center gap-1">
                      <span className="size-2 rounded-full bg-[#fbbf24]" />/<span className="size-2 rounded-full bg-[#f43f5e]" /> fire (low/high FRP)
                    </span>
                  )}
                  {showSites && (
                    <span className="inline-flex items-center gap-1">
                      <span className="size-2 rounded-full bg-[#94a3c0]" /> quarry <span className="size-2 rounded-full bg-[#f43f5e]" /> shaft
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {selected ? (
            <DistrictPanel key={selected.id} id={selected.id} name={selected.name} onClose={() => setSelectedId(null)} />
          ) : (
            <Card>
              <CardHeader icon={ShieldAlert} title="Select a district" subtitle="Click the map or a table row" />
              <CardBody className="space-y-3 text-xs leading-relaxed text-muted">
                <p>
                  The platform then compares the district&apos;s current Sentinel-2 indices (NDVI, BSI, NDMI, NDBI) and Sentinel-1 VH backscatter with the same weeks
                  last year, adds VIIRS fire activity, and produces a 0–100 disturbance screening score.
                </p>
                <p className="text-subtle">Highest fire density this week:</p>
                <div className="flex flex-wrap gap-1.5">
                  {[...(overview?.districts ?? [])]
                    .sort((a, b) => b.firesPer1000km2 - a.firesPer1000km2)
                    .slice(0, 6)
                    .map((d) => (
                      <button key={d.id} type="button" onClick={() => setSelectedId(d.id)} className="rounded-md border border-line px-2 py-1 text-fg hover:border-accent/40 hover:bg-accent/10">
                        {d.name} <span className="font-mono text-subtle">{d.firesPer1000km2}</span>
                      </button>
                    ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <Card>
        <CardHeader
          icon={MapPinned}
          title="All districts"
          subtitle="Fire detections from NASA FIRMS (NOAA-20 VIIRS); mapped sites from OpenStreetMap"
          action={
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter districts…"
                aria-label="Filter districts"
                className="h-8 w-44 rounded-lg border border-line bg-surface-2/70 pr-2 pl-8 text-xs placeholder:text-subtle focus:border-accent/50 focus:outline-none"
              />
            </div>
          }
        />
        <CardBody className="overflow-x-auto">
          {!overview ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="text-left text-[10px] tracking-wider text-subtle uppercase">
                  <Th {...th} k="name">District</Th>
                  <Th {...th} k="areaKm2" right>
                    Area km²
                  </Th>
                  <Th {...th} k="fires7d" right>
                    Fires 7 d
                  </Th>
                  <Th {...th} k="firesPer1000km2" right>
                    per 1,000 km²
                  </Th>
                  <Th {...th} k="night7d" right>
                    Night fires
                  </Th>
                  <Th {...th} k="miningSites" right>
                    Mapped sites
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((d: ZwOverviewDistrict) => (
                  <tr
                    key={d.id}
                    onClick={() => setSelectedId(d.id)}
                    className={cn("cursor-pointer transition-colors hover:bg-surface-2/60", d.id === selectedId && "bg-accent/[0.07]")}
                  >
                    <td className="py-2">
                      <span className="flex items-center gap-2">
                        <span className="size-2.5 rounded-sm" style={{ background: colorOf(d.id) ?? "transparent" }} />
                        {d.name}
                        {d.urban && <Badge className="py-0!">urban</Badge>}
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono text-muted">{d.areaKm2.toLocaleString("en-GB")}</td>
                    <td className="py-2 text-right font-mono">{d.fires7d}</td>
                    <td className="py-2 text-right font-mono">{d.firesPer1000km2}</td>
                    <td className="py-2 text-right font-mono text-muted">{d.night7d}</td>
                    <td className="py-2 text-right font-mono">{d.miningSites || <span className="text-subtle">0</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={BookOpenCheck} title="Method" />
          <CardBody>
            <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-muted">
              <li>Find the Sentinel-2 pass (≤15% cloud) that best covers the district in the last 45 days, and the matching pass one year earlier.</li>
              <li>Compute zonal means of NDVI, BSI, NDMI and NDBI over the district polygon for both passes (Planetary Computer statistics).</li>
              <li>Repeat with Sentinel-1 RTC VH/VV backscatter (30-day windows) — radar sees through rainy-season cloud.</li>
              <li>Count NOAA-20 VIIRS 375 m fire detections inside the district over 7 days.</li>
              <li>Blend the year-on-year changes into a weighted 0–100 score: soil 30%, vegetation 25%, fire 20%, radar 15%, moisture 10%.</li>
            </ol>
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={ShieldAlert} title="Limitations & data sources" />
          <CardBody className="space-y-2 text-xs leading-relaxed text-muted">
            <p>
              <strong className="text-fg">Screening, not enforcement.</strong> No public mining cadastre is available, so the platform cannot distinguish licensed from
              unlicensed activity. High scores identify where field verification is most useful.
            </p>
            <p>District averages dilute small artisanal sites — use the explorer&apos;s BSI, NDTI and radar layers to inspect individual locations.</p>
            <ul className="space-y-0.5 pt-1 text-[11px] text-subtle">
              <li>Boundaries: {overview?.sources.districts.source ?? "geoBoundaries"} · {overview?.sources.districts.license}</li>
              <li>
                Mining sites: {overview?.sources.miningSites.source} · {overview?.sources.miningSites.license} · snapshot{" "}
                {overview ? new Date(overview.sources.miningSites.snapshot).toLocaleDateString("en-GB") : ""}
              </li>
              <li>Fires: {overview?.firms.source}</li>
              <li>Imagery: Copernicus Sentinel-1/2 via Microsoft Planetary Computer</li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
