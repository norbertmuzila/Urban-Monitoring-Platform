"use client";

import { Download, ExternalLink, Layers3 } from "lucide-react";
import { Chart } from "react-chartjs-2";
import { useChipingeLandCover } from "@/lib/client/api";
import { grid } from "@/components/charts/setup";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";

const nf = new Intl.NumberFormat("en-GB");

/** Annual land-cover composition of Chipinge District from Impact Observatory 10 m maps. */
export function LandCoverCard() {
  const { data, error, mutate } = useChipingeLandCover();
  const first = data?.years[0];
  const last = data?.years.at(-1);
  const trees = (y: typeof first) => y?.km2.Trees ?? 0;
  const mean = (ys: NonNullable<typeof data>["years"]) => ys.reduce((s, y) => s + trees(y), 0) / ys.length;
  // Compare 3-year means at each end: single annual maps carry classification noise.
  const early = data && data.years.length >= 6 ? mean(data.years.slice(0, 3)) : null;
  const late = data && data.years.length >= 6 ? mean(data.years.slice(-3)) : null;

  return (
    <Card>
      <CardHeader
        icon={Layers3}
        title="Land cover 2017–2023"
        subtitle="Chipinge District · 10 m annual maps (Impact Observatory / Esri, Sentinel-2)"
        action={
          <a href="/api/chipinge/export" download className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2">
            <Download className="size-3.5" aria-hidden /> CSV
          </a>
        }
      />
      <CardBody className="space-y-4">
        {error && !data && <ErrorState message="Land-cover maps could not be loaded." onRetry={() => mutate()} />}
        {!data && !error && <Skeleton className="h-72 w-full" />}
        {data && first && last && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl bg-surface-2/70 px-3 py-2.5">
                <div className="text-[11px] text-subtle">Tree cover {last.year}</div>
                <div className="font-mono text-lg font-semibold text-ok">{nf.format(trees(last))} km²</div>
                <div className="text-[10px] text-subtle">{((last.shares.Trees ?? 0) * 100).toFixed(1)}% of district</div>
              </div>
              <div className="rounded-xl bg-surface-2/70 px-3 py-2.5">
                <div className="text-[11px] text-subtle">Tree cover {first.year}</div>
                <div className="font-mono text-lg font-semibold">{nf.format(trees(first))} km²</div>
                <div className="text-[10px] text-subtle">{((first.shares.Trees ?? 0) * 100).toFixed(1)}% of district</div>
              </div>
              <div className="rounded-xl bg-surface-2/70 px-3 py-2.5">
                <div className="text-[11px] text-subtle">3-yr mean change</div>
                <div className={`font-mono text-lg font-semibold ${early != null && late != null && late < early ? "text-danger" : "text-ok"}`}>
                  {early != null && late != null ? `${late >= early ? "+" : ""}${nf.format(Math.round(late - early))} km²` : "—"}
                </div>
                <div className="text-[10px] text-subtle">
                  {data.years.slice(-3)[0]?.year}–{last.year} vs {first.year}–{data.years[2]?.year}
                </div>
              </div>
              <div className="rounded-xl bg-surface-2/70 px-3 py-2.5">
                <div className="text-[11px] text-subtle">Crops {last.year}</div>
                <div className="font-mono text-lg font-semibold text-alert">{nf.format(last.km2.Crops ?? 0)} km²</div>
                <div className="text-[10px] text-subtle">{nf.format(first.km2.Crops ?? 0)} km² in {first.year}</div>
              </div>
            </div>

            <div className="h-72">
              <Chart
                type="bar"
                data={{
                  labels: data.years.map((y) => y.year),
                  datasets: data.classes
                    .filter((c) => data.years.some((y) => (y.km2[c.label] ?? 0) > 0))
                    .map((c) => ({
                      type: "bar" as const,
                      label: c.label,
                      data: data.years.map((y) => y.km2[c.label] ?? 0),
                      backgroundColor: c.color,
                      borderWidth: 0,
                      maxBarThickness: 48,
                    })),
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: { mode: "index", intersect: false },
                  plugins: {
                    legend: { position: "top", align: "end" },
                    tooltip: { callbacks: { label: (i) => ` ${i.dataset.label}: ${nf.format(Number(i.raw))} km²` } },
                  },
                  scales: {
                    x: { stacked: true, grid: { display: false }, border: { display: false } },
                    y: { stacked: true, grid, border: { display: false }, max: data.areaKm2, title: { display: true, text: "km²" } },
                  },
                }}
              />
            </div>

            <p className="text-[11px] leading-relaxed text-muted">
              Each year is an independent machine-learning classification of Sentinel-2 imagery, so single-year jumps partly reflect classification noise;
              compare multi-year averages. Areas are each class&apos;s pixel share × the official district area ({nf.format(data.areaKm2)} km²).
            </p>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <Badge>{data.source.split(" (")[0]}</Badge>
              <a href="https://planetarycomputer.microsoft.com/dataset/io-lulc-annual-v02" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                Dataset <ExternalLink className="size-3" aria-hidden />
              </a>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
