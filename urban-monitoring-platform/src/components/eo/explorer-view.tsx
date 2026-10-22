"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import { ArrowLeftRight, CalendarDays, Info, Layers, LoaderCircle, MapPin, SatelliteDish, ZoomIn } from "lucide-react";
import { useLocation } from "@/components/providers";
import { useEoLayers, useEoScenes, useEoTiles } from "@/lib/client/api";
import type { EoLayerInfo } from "@/lib/eo/layers";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Flag } from "@/components/ui/flag";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { BASEMAP_OPTIONS, type BasemapId } from "@/components/maps/basemaps";
import { EoLegendView } from "./eo-legend";
import type { EoTileSource, MapView } from "./eo-map-canvas";
import { ZIMBABWE_PLACES, type Place } from "./places";

const EoMapCanvas = dynamic(() => import("./eo-map-canvas"), { ssr: false, loading: () => <Skeleton className="size-full rounded-none" /> });

const COMPARE_OFFSETS = [
  { value: "365", label: "1 year" },
  { value: "180", label: "6 months" },
  { value: "90", label: "3 months" },
];

const isoToday = () => new Date().toISOString().slice(0, 10);
const shift = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function toSource(info: { tileUrl: string; maxNativeZoom: number; layer: EoLayerInfo } | undefined): EoTileSource | null {
  if (!info) return null;
  return { url: info.tileUrl, maxNativeZoom: info.maxNativeZoom, minZoom: info.layer.minZoom ?? 0, attribution: info.layer.attribution };
}

export interface ExplorerInitial {
  layer: string;
  lat: number;
  lng: number;
  zoom: number;
}

export function ExplorerView({ initial }: { initial: ExplorerInitial }) {
  const { location, recent } = useLocation();
  const { data: catalogue } = useEoLayers();
  const [layerId, setLayerId] = useState(initial.layer);
  const [days, setDays] = useState(60);
  const [end, setEnd] = useState(isoToday);
  const [compare, setCompare] = useState(false);
  const [offset, setOffset] = useState("365");
  const [ratio, setRatio] = useState(0.5);
  const [opacity, setOpacity] = useState(0.95);
  const [basemap, setBasemap] = useState<BasemapId>("dark");
  const [target, setTarget] = useState({ lat: initial.lat, lng: initial.lng, zoom: initial.zoom });
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [view, setView] = useState<MapView | null>(null);

  const layer = catalogue?.layers.find((l) => l.id === layerId) ?? null;
  const temporal = layer?.temporal === "recent";
  const beforeEnd = shift(end, -Number(offset));

  const after = useEoTiles(layerId, days, end);
  const before = useEoTiles(compare && temporal ? layerId : null, days, beforeEnd);
  const scenes = useEoScenes(layer?.source.kind === "planetary-computer" ? layerId : null, days, end, view && view.zoom >= 7 ? view.bbox : null);

  const belowMinZoom = layer?.minZoom != null && view != null && view.zoom < layer.minZoom;

  const places: Place[] = useMemo(
    () => [
      ...[location, ...recent.filter((r) => r.id !== location.id)].slice(0, 6).map((c) => ({ id: `loc-${c.id}`, label: c.name, hint: c.country, lat: c.lat, lng: c.lng, zoom: 12, iso2: c.iso2.toLowerCase() })),
      // Skip presets that duplicate one of the viewer's recent places.
      ...ZIMBABWE_PLACES.filter((p) => !recent.some((r) => r.name === p.label) && p.label !== location.name),
    ],
    [location, recent],
  );
  const goTo = (p: Place) => {
    setPlaceId(p.id);
    setTarget({ lat: p.lat, lng: p.lng, zoom: Math.max(p.zoom, layer?.minZoom ?? 0) });
  };

  // Drag handle for the before/after divider.
  const mapBox = useRef<HTMLDivElement>(null);
  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    const rect = mapBox.current!.getBoundingClientRect();
    const move = (ev: PointerEvent) => setRatio(Math.min(0.98, Math.max(0.02, (ev.clientX - rect.left) / rect.width)));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <>
      <PageHeader
        title="Satellite explorer"
        description="Live Copernicus, Landsat, JAXA and NASA layers. Pick a layer, a place and a time window; compare mode swipes between two dates."
        actions={
          <Badge tone="ok" live>
            Live STAC catalogue
          </Badge>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        {/* ------------------------------------------------------------ controls */}
        <div className="order-2 space-y-4 xl:order-1">
          <Card>
            <CardHeader icon={Layers} title="Layer" subtitle={layer ? `${layer.sensor} · ${layer.resolution}` : "Loading catalogue…"} />
            <CardBody className="max-h-[420px] space-y-3 overflow-y-auto">
              {!catalogue && <Skeleton className="h-64 w-full" />}
              {catalogue?.groups.map((g) => (
                <div key={g}>
                  <div className="mb-1 text-[10px] font-semibold tracking-[0.12em] text-subtle uppercase">{g}</div>
                  <div className="space-y-0.5" role="radiogroup" aria-label={g}>
                    {catalogue.layers
                      .filter((l) => l.group === g)
                      .map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          role="radio"
                          aria-checked={l.id === layerId}
                          onClick={() => setLayerId(l.id)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                            l.id === layerId ? "bg-accent/10 text-fg ring-1 ring-accent/30" : "text-muted hover:bg-surface-2 hover:text-fg",
                          )}
                        >
                          {l.label}
                          {l.temporal === "static" && <span className="text-[10px] text-subtle">static</span>}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={CalendarDays} title="Time window" subtitle={temporal ? `Clearest scenes between ${fmtDate(shift(end, -days))} and ${fmtDate(end)}` : "Fixed-vintage product"} />
            <CardBody className="space-y-3">
              <label className="flex items-center justify-between gap-3 text-xs text-muted">
                End date
                <input
                  type="date"
                  value={end}
                  min="2017-06-01"
                  max={isoToday()}
                  disabled={!temporal}
                  onChange={(e) => e.target.value && setEnd(e.target.value)}
                  className="rounded-md border border-line bg-surface-2 px-2 py-1 font-mono text-xs text-fg [color-scheme:dark] disabled:opacity-40"
                />
              </label>
              <Segmented
                label="Window length"
                size="xs"
                value={String(days)}
                onChange={(v) => setDays(Number(v))}
                options={(catalogue?.windows ?? [15, 30, 60, 90, 180]).map((d) => ({ value: String(d), label: `${d} d` }))}
                className={cn("w-full justify-between", !temporal && "pointer-events-none opacity-40")}
              />
              <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <input type="checkbox" checked={compare} disabled={!temporal} onChange={(e) => setCompare(e.target.checked)} className="accent-[var(--color-accent)]" />
                  <ArrowLeftRight className="size-3.5 text-accent" aria-hidden /> Compare with
                </label>
                <Segmented label="Compare offset" size="xs" value={offset} onChange={setOffset} options={COMPARE_OFFSETS} className={cn(!(compare && temporal) && "pointer-events-none opacity-40")} />
              </div>
              <label className="flex items-center gap-3 text-xs text-muted">
                Opacity
                <input type="range" className="range flex-1" min={0.2} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} />
                <span className="w-9 text-right font-mono">{Math.round(opacity * 100)}%</span>
              </label>
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={MapPin} title="Places" subtitle="Your recent cities and Zimbabwe focus areas" />
            <CardBody className="grid grid-cols-2 gap-1.5">
              {places.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => goTo(p)}
                  aria-pressed={placeId === p.id}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-left transition-colors",
                    placeId === p.id ? "border-accent/40 bg-accent/10" : "border-line bg-surface-2/50 hover:border-line-strong",
                  )}
                >
                  <span className="flex items-center gap-1.5 truncate text-xs font-medium">
                    {p.iso2 && <Flag iso2={p.iso2} className="h-2.5 w-3.5" />}
                    {p.label}
                  </span>
                  <span className="block truncate text-[10px] text-subtle">{p.hint}</span>
                </button>
              ))}
            </CardBody>
          </Card>
        </div>

        {/* ---------------------------------------------------------------- map */}
        <div className="order-1 space-y-4 xl:order-2">
          <div ref={mapBox} className="relative h-[62dvh] min-h-[440px] overflow-hidden rounded-[var(--radius-card)] border border-line xl:h-[calc(100dvh-14rem)]">
            <EoMapCanvas
              basemap={basemap}
              target={target}
              after={toSource(after.data)}
              before={compare && temporal ? toSource(before.data) : null}
              ratio={ratio}
              opacity={opacity}
              onView={setView}
            />

            <div className="pointer-events-none absolute inset-x-3 top-3 z-[1000] flex flex-wrap items-start justify-between gap-2">
              <span className="pointer-events-auto inline-flex items-center gap-2 rounded-lg border border-line-strong bg-surface/95 px-3 py-1.5 text-xs font-medium backdrop-blur">
                {after.isLoading ? <LoaderCircle className="size-3.5 animate-spin text-accent" aria-hidden /> : <SatelliteDish className="size-3.5 text-accent" aria-hidden />}
                {layer?.label ?? "…"}
                {after.error && <span className="text-subtle">· refreshing</span>}
              </span>
              <Segmented label="Basemap" size="xs" value={basemap} onChange={setBasemap} options={BASEMAP_OPTIONS} className="pointer-events-auto" />
            </div>

            {belowMinZoom && (
              <div className="absolute inset-x-0 top-16 z-[1000] flex justify-center">
                <span className="inline-flex items-center gap-2 rounded-full border border-warn/30 bg-surface/95 px-3 py-1.5 text-xs text-warn shadow-lg backdrop-blur">
                  <ZoomIn className="size-3.5" aria-hidden /> Zoom in to level {layer!.minZoom} to load {layer!.label}
                </span>
              </div>
            )}

            {compare && temporal && (
              <>
                <div className="pointer-events-none absolute inset-y-0 z-[1000] w-0.5 bg-white/90 shadow-[0_0_8px_rgba(0,0,0,0.6)]" style={{ left: `${ratio * 100}%` }} />
                <button
                  type="button"
                  aria-label="Drag to compare dates"
                  onPointerDown={startDrag}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowLeft") setRatio((r) => Math.max(0.02, r - 0.05));
                    if (e.key === "ArrowRight") setRatio((r) => Math.min(0.98, r + 0.05));
                  }}
                  className="absolute top-1/2 z-[1001] grid size-9 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full border border-white/60 bg-surface/95 text-fg shadow-xl"
                  style={{ left: `${ratio * 100}%` }}
                >
                  <ArrowLeftRight className="size-4" aria-hidden />
                </button>
                <span className="absolute bottom-3 left-3 z-[1000] rounded-md bg-surface/95 px-2 py-1 font-mono text-[11px] backdrop-blur">◀ {fmtDate(beforeEnd)}</span>
                <span className="absolute right-14 bottom-3 z-[1000] rounded-md bg-surface/95 px-2 py-1 font-mono text-[11px] backdrop-blur">{fmtDate(end)} ▶</span>
              </>
            )}

            {layer?.legend && (
              <div className={cn("absolute left-3 z-[1000] w-60 rounded-xl border border-line-strong bg-surface/95 p-3 shadow-lg backdrop-blur", compare && temporal ? "bottom-12" : "bottom-3")}>
                <div className="mb-2 text-[11px] font-semibold">{layer.label}</div>
                <EoLegendView legend={layer.legend} compact />
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader icon={Info} title="What this layer shows" subtitle={layer ? `${layer.sensor} · revisit ${layer.revisit}` : undefined} />
              <CardBody className="space-y-3 text-xs">
                {layer ? (
                  <>
                    <p className="leading-relaxed text-muted">{layer.detects}</p>
                    {layer.formula && <div className="rounded-lg bg-surface-2 px-3 py-2 font-mono text-[11px] text-fg">{layer.formula}</div>}
                    <div className="flex flex-wrap gap-1.5">
                      <Badge>{layer.resolution}</Badge>
                      <Badge>{layer.revisit}</Badge>
                      {layer.minZoom != null && <Badge>Renders from zoom {layer.minZoom}</Badge>}
                    </div>
                    <p className="text-[10px] text-subtle">{layer.attribution}</p>
                  </>
                ) : (
                  <Skeleton className="h-24 w-full" />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                icon={SatelliteDish}
                title="Acquisitions in view"
                subtitle={temporal ? "Scenes inside the window, newest first" : "Product tiles covering the view"}
                action={scenes.isLoading && <LoaderCircle className="size-4 animate-spin text-subtle" aria-hidden />}
              />
              <CardBody>
                {layer?.source.kind === "gibs" ? (
                  <p className="text-xs text-muted">Nightly global composite from NASA GIBS — night of {after.data?.window ? fmtDate(after.data.window.end) : "…"}.</p>
                ) : !view || view.zoom < 7 ? (
                  <p className="text-xs text-subtle">Zoom in to list the scenes behind this view.</p>
                ) : scenes.error ? (
                  <p className="text-xs text-subtle">Scene list is refreshing…</p>
                ) : scenes.data && scenes.data.scenes.length === 0 ? (
                  <p className="text-xs text-warn">No scenes match this window — widen the window or relax the date.</p>
                ) : (
                  <ul className="max-h-56 space-y-1 overflow-y-auto">
                    {scenes.data?.scenes.map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-3 rounded-md bg-surface-2/60 px-2.5 py-1.5 text-[11px]">
                        <span className="min-w-0">
                          <span className="block font-mono text-fg">{fmtDate(s.datetime)}</span>
                          <span className="block truncate text-subtle" title={s.id}>
                            {s.platform ?? s.collection} · {s.id.slice(0, 32)}
                          </span>
                        </span>
                        {s.cloudCover != null && <span className="shrink-0 font-mono text-muted">{s.cloudCover.toFixed(1)}% cloud</span>}
                      </li>
                    ))}
                    {!scenes.data && <Skeleton className="h-24 w-full" />}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
