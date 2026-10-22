"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, ExternalLink, Flame, LoaderCircle, Pickaxe, Radar, Satellite, ShieldAlert, TriangleAlert, X } from "lucide-react";
import { useDistrictAnalysis } from "@/lib/client/api";
import type { DistrictAnalysis, Indicator } from "@/lib/server/eo/district-analysis";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";

export const LEVEL_STYLE = {
  low: { label: "Low", color: "#34d399", tone: "ok" },
  moderate: { label: "Moderate", color: "#fbbf24", tone: "warn" },
  elevated: { label: "Elevated", color: "#fb923c", tone: "warn" },
  high: { label: "High", color: "#f43f5e", tone: "danger" },
  "insufficient-data": { label: "Insufficient data", color: "#64739a", tone: "neutral" },
} as const;

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function ScoreGauge({ score, level }: { score: number | null; level: DistrictAnalysis["screening"]["level"] }) {
  const s = LEVEL_STYLE[level];
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid size-24 shrink-0 place-items-center">
      <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--color-surface-3)" strokeWidth="7" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={s.color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${((score ?? 0) / 100) * c} ${c}`} />
      </svg>
      <div className="text-center">
        <div className="font-mono text-2xl font-semibold" style={{ color: s.color }}>
          {score ?? "—"}
        </div>
        <div className="text-[9px] tracking-wider text-subtle uppercase">of 100</div>
      </div>
    </div>
  );
}

function deltaClass(i: Indicator) {
  if (i.delta == null || Math.abs(i.delta) < (i.unit === "dB" ? 0.3 : 0.01)) return "text-muted";
  const bad = i.concern === "increase" ? i.delta > 0 : i.delta < 0;
  return bad ? "text-danger" : "text-ok";
}

/** Elapsed-seconds counter shown while a first (uncached) analysis runs. */
function useElapsed(running: boolean) {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    const id = setInterval(() => setS(Math.round((Date.now() - start) / 1000)), 1000);
    return () => {
      clearInterval(id);
      setS(0);
    };
  }, [running]);
  return s;
}

export function DistrictPanel({ id, name, onClose }: { id: string; name: string; onClose: () => void }) {
  const { data: a, error, isLoading, mutate } = useDistrictAnalysis(id);
  const elapsed = useElapsed(isLoading);

  return (
    <Card className="flex flex-col">
      <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <div className="text-[11px] font-semibold tracking-wider text-subtle uppercase">District screening</div>
          <h2 className="text-lg font-semibold tracking-tight">{name}</h2>
          {a && (
            <p className="text-xs text-muted">
              {a.district.areaKm2.toLocaleString("en-GB")} km² · {a.district.urban ? "Urban council" : "Rural district"}
            </p>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label="Close district" className="rounded-md p-1.5 text-subtle hover:bg-surface-2 hover:text-fg">
          <X className="size-4" aria-hidden />
        </button>
      </header>

      {isLoading && !a && (
        <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
          <LoaderCircle className="size-6 animate-spin text-accent" aria-hidden />
          <p className="text-sm">Computing satellite statistics… {elapsed > 0 && <span className="font-mono text-muted">{elapsed}s</span>}</p>
          <p className="max-w-xs text-xs text-subtle">
            Searching Sentinel-2 and Sentinel-1 passes for this season and last year, then running zonal statistics over the district. The first request takes 10–40 s; results are cached for everyone.
          </p>
        </div>
      )}

      {error && !a && <ErrorState message={error.message} onRetry={() => mutate()} />}

      {a && (
        <div className="space-y-5 px-5 py-4">
          <div className="flex items-center gap-4">
            <ScoreGauge score={a.screening.score} level={a.screening.level} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-4" style={{ color: LEVEL_STYLE[a.screening.level].color }} aria-hidden />
                <span className="text-sm font-semibold">{LEVEL_STYLE[a.screening.level].label} disturbance signal</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {fmtDate(a.periods.current.start)} – {fmtDate(a.periods.current.end)} compared with the same weeks of the previous year.
              </p>
            </div>
          </div>

          <ul className="space-y-2">
            {a.screening.components.map((c) => (
              <li key={c.id}>
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span title={c.detail}>
                    {c.label} <span className="text-subtle">· {Math.round(c.weight * 100)}%</span>
                  </span>
                  <span className="font-mono text-muted">{c.signal == null ? "n/a" : Math.round(c.signal * 100)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(c.signal ?? 0) * 100}%`, background: c.signal == null ? "transparent" : c.signal > 0.66 ? "#f43f5e" : c.signal > 0.33 ? "#fb923c" : "#34d399" }}
                  />
                </div>
              </li>
            ))}
          </ul>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] tracking-wider text-subtle uppercase">
                  <th className="pb-1.5 font-medium">Indicator</th>
                  <th className="pb-1.5 text-right font-medium">Now</th>
                  <th className="pb-1.5 text-right font-medium">Last year</th>
                  <th className="pb-1.5 text-right font-medium">Δ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {a.indicators.map((i) => (
                  <tr key={i.id} title={i.note}>
                    <td className="py-1.5">{i.label}</td>
                    <td className="py-1.5 text-right font-mono">{i.current?.toFixed(i.unit ? 1 : 3) ?? "—"}</td>
                    <td className="py-1.5 text-right font-mono text-muted">{i.baseline?.toFixed(i.unit ? 1 : 3) ?? "—"}</td>
                    <td className={cn("py-1.5 text-right font-mono", deltaClass(i))}>
                      {i.delta == null ? "—" : `${i.delta > 0 ? "+" : ""}${i.delta.toFixed(i.unit ? 1 : 3)}${i.unit ? ` ${i.unit}` : ""}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1.5 text-[10px] text-subtle">Red Δ = change in the direction associated with disturbance. Hover a row for its meaning.</p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-surface-2 p-2.5">
              <Flame className="mx-auto size-4 text-alert" aria-hidden />
              <div className="mt-1 font-mono text-base font-semibold">{a.fires.last7d}</div>
              <div className="text-[10px] text-subtle">fires · 7 d</div>
            </div>
            <div className="rounded-lg bg-surface-2 p-2.5">
              <Flame className="mx-auto size-4 text-violet" aria-hidden />
              <div className="mt-1 font-mono text-base font-semibold">{a.fires.night7d}</div>
              <div className="text-[10px] text-subtle">night fires</div>
            </div>
            <div className="rounded-lg bg-surface-2 p-2.5">
              <Pickaxe className="mx-auto size-4 text-warn" aria-hidden />
              <div className="mt-1 font-mono text-base font-semibold">{a.miningSites.count}</div>
              <div className="text-[10px] text-subtle">mapped sites</div>
            </div>
          </div>

          <div className="space-y-1.5 text-[11px]">
            {(
              [
                ["Sentinel-2 now", a.optical.current, Satellite],
                ["Sentinel-2 last year", a.optical.baseline, Satellite],
                ["Sentinel-1 now", a.radar.current, Radar],
                ["Sentinel-1 last year", a.radar.baseline, Radar],
              ] as const
            ).map(([label, acq, Icon]) => (
              <div key={label} className="flex items-center justify-between gap-2 rounded-md bg-surface-2/60 px-2.5 py-1.5">
                <span className="flex items-center gap-1.5 text-muted">
                  <Icon className="size-3.5" aria-hidden /> {label}
                </span>
                {acq ? (
                  <span className="font-mono" title={acq.scenes.map((s) => s.id).join("\n")}>
                    {fmtDate(acq.date)} · {acq.scenes.length} tile{acq.scenes.length > 1 ? "s" : ""} · {Math.round(acq.coverage * 100)}%
                  </span>
                ) : (
                  <span className="text-warn">no clear pass</span>
                )}
              </div>
            ))}
          </div>

          <ul className="space-y-1.5">
            {a.caveats.map((c) => (
              <li key={c} className="flex gap-2 text-[11px] leading-relaxed text-muted">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden />
                {c}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <Link
              href={`/explorer?layer=bsi&lat=${a.district.centroid[1]}&lng=${a.district.centroid[0]}&z=11`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20"
            >
              <ExternalLink className="size-3.5" aria-hidden /> Inspect in explorer
            </Link>
            <a
              href={`/api/zw/districts/${a.district.id}/analysis?format=geojson`}
              download
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
            >
              <Download className="size-3.5" aria-hidden /> GeoJSON
            </a>
            <Badge className="ml-auto self-center">Computed {new Date(a.generatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</Badge>
          </div>
        </div>
      )}
    </Card>
  );
}
