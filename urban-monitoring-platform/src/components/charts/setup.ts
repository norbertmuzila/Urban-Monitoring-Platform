"use client";

import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  RadialLinearScale,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { palette } from "@/lib/format";

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  RadialLinearScale,
  Tooltip,
);

Chart.defaults.color = palette.muted;
Chart.defaults.borderColor = palette.line;
// Canvas cannot resolve CSS variables, so read the family next/font generated.
if (typeof window !== "undefined") {
  const inter = getComputedStyle(document.documentElement).getPropertyValue("--font-inter").trim();
  Chart.defaults.font.family = `${inter || "Inter"}, system-ui, sans-serif`;
}
Chart.defaults.font.size = 11;
Chart.defaults.plugins.legend.labels.boxWidth = 10;
Chart.defaults.plugins.legend.labels.boxHeight = 10;
Chart.defaults.plugins.legend.labels.useBorderRadius = true;
Chart.defaults.plugins.legend.labels.borderRadius = 3;
Chart.defaults.plugins.tooltip.backgroundColor = "rgba(11,17,32,0.96)";
Chart.defaults.plugins.tooltip.borderColor = "rgba(148,163,184,0.22)";
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.titleColor = "#e7ecf6";
Chart.defaults.plugins.tooltip.bodyColor = "#cbd5e1";

export const grid = { color: palette.line };

/** Common cartesian options; merge per chart. */
export function cartesian(opts: { yTitle?: string; stacked?: boolean; legend?: boolean } = {}): ChartOptions<"bar" | "line"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { display: opts.legend ?? true, position: "top", align: "end" } },
    scales: {
      x: { stacked: opts.stacked, grid: { display: false }, border: { display: false } },
      y: {
        stacked: opts.stacked,
        grid,
        border: { display: false },
        beginAtZero: true,
        title: opts.yTitle ? { display: true, text: opts.yTitle } : undefined,
      },
    },
  };
}

export { palette };
