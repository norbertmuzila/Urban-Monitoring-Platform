import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Skeleton } from "./skeleton";

export const statTones = {
  accent: "text-accent bg-accent/10 border-accent/20",
  ok: "text-ok bg-ok/10 border-ok/20",
  warn: "text-warn bg-warn/10 border-warn/20",
  alert: "text-alert bg-alert/10 border-alert/20",
  danger: "text-danger bg-danger/10 border-danger/20",
  violet: "text-violet bg-violet/10 border-violet/20",
  sky: "text-sky bg-sky/10 border-sky/20",
} as const;

export function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  hint,
  tone = "accent",
  valueColor,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  tone?: keyof typeof statTones;
  /** Overrides the value colour, e.g. for AQI bands. */
  valueColor?: string;
  loading?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface/80 p-4 transition-colors hover:border-line-strong">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-muted">{label}</span>
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg border", statTones[tone])}>
          <Icon className="size-4" strokeWidth={1.75} aria-hidden />
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        {loading ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <>
            <span
              className="font-mono text-2xl font-semibold tracking-tight tabular-nums"
              style={valueColor ? { color: valueColor } : undefined}
            >
              {value}
            </span>
            {unit && <span className="text-sm text-subtle">{unit}</span>}
          </>
        )}
      </div>
      {hint && <div className="mt-1.5 truncate text-[11px] text-subtle">{hint}</div>}
    </div>
  );
}
