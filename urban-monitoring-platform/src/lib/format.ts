const nf = new Intl.NumberFormat("en-GB");

export const fmt = {
  int: (n: number | null | undefined) => (n == null ? "—" : nf.format(Math.round(n))),
  dp: (n: number | null | undefined, dp = 1) => (n == null ? "—" : n.toFixed(dp)),
  /** Compact hectares: 1.2 Mha, 845 kha, 920 ha. */
  ha: (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)} Mha` : n >= 1e4 ? `${(n / 1e3).toFixed(0)} kha` : `${nf.format(n)} ha`),
  compact: (n: number) => new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(n),
  signedPct: (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`,
  time: (iso: string | Date) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
};

/** Shared colour palette (mirrors globals.css tokens) for canvas/SVG drawing. */
export const palette = {
  accent: "#22d3ee",
  ok: "#34d399",
  warn: "#fbbf24",
  alert: "#fb923c",
  danger: "#f43f5e",
  violet: "#a78bfa",
  sky: "#38bdf8",
  muted: "#94a3c0",
  subtle: "#64739a",
  line: "rgba(148,163,184,0.12)",
  surface: "#0b1120",
} as const;
