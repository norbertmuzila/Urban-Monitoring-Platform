"use client";

import { Line } from "react-chartjs-2";
import { grid, palette } from "@/components/charts/setup";
import { wallClock } from "@/lib/weather";

interface Point {
  time: string;
  predicted: number;
  lower: number;
  upper: number;
  reference: number | null;
}

/**
 * Observed history (solid), model prediction with 80% interval (band) and the
 * reference forecast it is compared with (dashed).
 */
export function PredictionChart({
  history,
  points,
  unit,
  color,
  referenceLabel,
}: {
  history: { time: string; observed: number }[];
  points: Point[];
  unit: string;
  color: string;
  referenceLabel: string;
}) {
  const labels = [...history.map((h) => h.time), ...points.map((p) => p.time)];
  const pad = <T,>(before: number, values: T[], after = 0) => [...Array(before).fill(null), ...values, ...Array(after).fill(null)];
  const nh = history.length;
  // Join the forecast lines to the last observation so the curves are continuous.
  const last = history.length ? (history[history.length - 1].observed ?? null) : null;

  return (
    <Line
      data={{
        labels,
        datasets: [
          {
            label: "Observed",
            data: pad(0, history.map((h) => h.observed), points.length),
            borderColor: palette.muted,
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.3,
          },
          {
            label: "80% interval (low)",
            data: pad(nh - 1, [last, ...points.map((p) => p.lower)]),
            borderWidth: 0,
            pointRadius: 0,
            tension: 0.3,
          },
          {
            label: "80% interval",
            data: pad(nh - 1, [last, ...points.map((p) => p.upper)]),
            borderWidth: 0,
            pointRadius: 0,
            backgroundColor: `${color}26`,
            fill: "-1",
            tension: 0.3,
          },
          {
            label: "Model prediction",
            data: pad(nh - 1, [last, ...points.map((p) => p.predicted)]),
            borderColor: color,
            borderWidth: 2.5,
            pointRadius: 0,
            tension: 0.3,
          },
          {
            label: referenceLabel,
            data: pad(nh - 1, [last, ...points.map((p) => p.reference)]),
            borderColor: palette.violet,
            borderDash: [5, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "top",
            align: "end",
            labels: { filter: (item) => item.text !== "80% interval (low)" },
          },
          tooltip: {
            filter: (item) => item.dataset.label !== "80% interval (low)" && item.raw != null,
            callbacks: {
              title: (items) => wallClock(String(labels[items[0].dataIndex]), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
              label: (item) => ` ${item.dataset.label}: ${Number(item.raw).toFixed(1)} ${unit}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              maxTicksLimit: 10,
              callback: (_v, i) => wallClock(labels[i], { weekday: "short", hour: "2-digit" }),
            },
          },
          y: { grid, border: { display: false }, title: { display: true, text: unit } },
        },
      }}
    />
  );
}
