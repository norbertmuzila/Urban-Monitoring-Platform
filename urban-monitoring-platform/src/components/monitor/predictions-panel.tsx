"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, ExternalLink, LoaderCircle, Sparkles, ThermometerSun, Wind } from "lucide-react";
import { usePrediction } from "@/lib/client/api";
import type { Location } from "@/lib/data/types";
import { cn } from "@/lib/cn";
import { palette } from "@/lib/format";
import { pm25Band, wallClock } from "@/lib/weather";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { PredictionChart } from "./prediction-chart";

const pct = (a: number, b: number) => (b > 0 ? Math.round(((b - a) / b) * 100) : 0);

function Elapsed({ running }: { running: boolean }) {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    const id = setInterval(() => setS(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [running]);
  return running && s > 0 ? <span className="font-mono text-subtle">{s}s</span> : null;
}

export function PredictionsPanel({ location }: { location: Location }) {
  const { data, error, isLoading, mutate } = usePrediction(location);
  const [tab, setTab] = useState<"temperature" | "pm25">("temperature");

  const t = data?.temperature;
  const p = data?.pm25;

  // Daily summaries of the model output.
  const days: { day: string; a: string; b: string; note: string; color?: string }[] = (() => {
    if (tab === "temperature" && t) {
      const by = new Map<string, number[]>();
      for (const h of t.hours) by.set(h.time.slice(0, 10), [...(by.get(h.time.slice(0, 10)) ?? []), h.predicted]);
      return [...by].slice(0, 3).map(([d, v]) => ({ day: d, a: `${Math.round(Math.min(...v))}°`, b: `${Math.round(Math.max(...v))}°`, note: "min / max" }));
    }
    if (tab === "pm25" && p) {
      const by = new Map<string, number[]>();
      for (const h of p.hours) by.set(h.time.slice(0, 10), [...(by.get(h.time.slice(0, 10)) ?? []), h.predicted]);
      return [...by].slice(0, 3).map(([d, v]) => {
        const mean = v.reduce((s, x) => s + x, 0) / v.length;
        return { day: d, a: mean.toFixed(1), b: pm25Band(mean)?.label ?? "", note: "mean µg/m³", color: pm25Band(mean)?.color };
      });
    }
    return [];
  })();

  return (
    <Card>
      <CardHeader
        icon={Sparkles}
        title="72-hour prediction"
        subtitle="Background models trained for this exact location and checked against what actually happened"
        action={
          <Segmented
            label="Variable"
            size="xs"
            value={tab}
            onChange={setTab}
            options={[
              { value: "temperature", label: "Temperature", icon: ThermometerSun },
              { value: "pm25", label: "PM2.5", icon: Wind },
            ]}
          />
        }
      />
      <CardBody className="space-y-4">
        {isLoading && !data && (
          <div className="flex h-72 flex-col items-center justify-center gap-2 text-center text-sm text-muted">
            <LoaderCircle className="size-6 animate-spin text-accent" aria-hidden />
            Training models on 92 days of data for {location.name}… <Elapsed running={isLoading} />
            <span className="text-xs text-subtle">First run per location takes a few seconds; results are cached.</span>
          </div>
        )}
        {error && !data && <ErrorState message={error.message} onRetry={() => mutate()} />}

        {data && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {days.map((d) => (
                <div key={d.day} className="rounded-xl bg-surface-2/70 px-3 py-2.5">
                  <div className="text-[11px] text-subtle">{wallClock(`${d.day}T12:00`, { weekday: "long" })}</div>
                  <div className="mt-0.5 flex items-baseline gap-2">
                    <span className="font-mono text-lg font-semibold">{d.a}</span>
                    <span className="text-sm" style={{ color: d.color }}>
                      {d.b}
                    </span>
                  </div>
                  <div className="text-[10px] text-subtle">{d.note}</div>
                </div>
              ))}
            </div>

            <div className="h-72">
              {tab === "temperature" && t && (
                <PredictionChart
                  history={t.history}
                  points={t.hours.map((h) => ({ ...h, reference: h.forecast }))}
                  unit="°C"
                  color={palette.alert}
                  referenceLabel="Raw ECMWF/DWD forecast"
                />
              )}
              {tab === "pm25" && p && (
                <PredictionChart
                  history={p.history}
                  points={p.hours.map((h) => ({ ...h, reference: h.cams }))}
                  unit="µg/m³"
                  color={palette.accent}
                  referenceLabel="CAMS operational forecast"
                />
              )}
              {((tab === "temperature" && !t) || (tab === "pm25" && !p)) && (
                <div className="grid h-full place-items-center text-sm text-muted">Not enough history at this location to train this model.</div>
              )}
            </div>

            {/* ------------------------------------------------ verification */}
            <div className="rounded-xl border border-ok/20 bg-ok/[0.04] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <BadgeCheck className="size-4 text-ok" aria-hidden /> Verified accuracy · last 7 days, unseen by the model
              </div>
              {tab === "temperature" && t && (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] tracking-wider text-subtle uppercase">
                      <th className="pb-1.5 font-medium">Lead time</th>
                      <th className="pb-1.5 text-right font-medium">Raw forecast error</th>
                      <th className="pb-1.5 text-right font-medium">Published error</th>
                      <th className="pb-1.5 text-right font-medium">Change</th>
                      <th className="hidden pb-1.5 text-right font-medium sm:table-cell">Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {t.verification.map((v) => {
                      const imp = pct(v.maeModel, v.maeForecast);
                      return (
                        <tr key={v.lead}>
                          <td className="py-1.5">Day {v.lead} ahead</td>
                          <td className="py-1.5 text-right font-mono text-muted">±{v.maeForecast.toFixed(2)} °C</td>
                          <td className="py-1.5 text-right font-mono">±{v.maeModel.toFixed(2)} °C</td>
                          <td className={cn("py-1.5 text-right font-mono", imp > 0 ? "text-ok" : imp < 0 ? "text-alert" : "text-muted")}>
                            {imp > 0 ? `${imp}% better` : imp < 0 ? `${-imp}% worse` : "same"}
                          </td>
                          <td className="hidden py-1.5 text-right text-subtle sm:table-cell">{v.method}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {tab === "pm25" && p && (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] tracking-wider text-subtle uppercase">
                      <th className="pb-1.5 font-medium">Horizon</th>
                      <th className="pb-1.5 text-right font-medium">Persistence</th>
                      <th className="pb-1.5 text-right font-medium">Daily cycle</th>
                      <th className="pb-1.5 text-right font-medium">Published</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {p.verification.map((v) => {
                      const best = Math.min(v.maeModel, v.maePersistence, v.maeDiurnal);
                      const cls = (x: number) => cn("py-1.5 text-right font-mono", x === best ? "text-ok" : "text-muted");
                      return (
                        <tr key={v.horizon}>
                          <td className="py-1.5">{v.horizon}</td>
                          <td className={cls(v.maePersistence)}>±{v.maePersistence.toFixed(1)}</td>
                          <td className={cls(v.maeDiurnal)}>±{v.maeDiurnal.toFixed(1)}</td>
                          <td className={cls(v.maeModel)}>±{v.maeModel.toFixed(1)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-muted">
                {tab === "temperature"
                  ? "Mean absolute error against the realised hourly temperature during the last 7 days — a week the model never saw while being trained or selected. For each lead day the platform publishes whichever candidate (raw forecast, bias-adjusted forecast or a learned correction) was most accurate on the preceding week."
                  : `Mean absolute error in µg/m³ against hourly CAMS values during the last 7 days, unseen in training. “Persistence” repeats the last value; “daily cycle” repeats the past week's average for that hour. Published method: ${p?.method ?? "—"}. Green = most accurate.`}{" "}
                Band on the chart = 80% of held-out errors.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                <Badge tone="ok">
                  Trained on {(tab === "temperature" ? t?.trainedOn.samples : p?.trainedOn.samples)?.toLocaleString("en-GB") ?? "—"} samples
                </Badge>
                <span className="text-subtle">Retrained hourly · {new Date(data.generatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                {data.sources.map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline" title={s.label}>
                    <ExternalLink className="size-3" aria-hidden /> {s.label.split(" (")[0]}
                  </a>
                ))}
              </div>
            </div>
          </>
        )}
        {!data && !isLoading && !error && <Skeleton className="h-72 w-full" />}
      </CardBody>
    </Card>
  );
}
