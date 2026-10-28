import type { EoLegend } from "@/lib/eo/layers";

export function EoLegendView({ legend, compact }: { legend: EoLegend; compact?: boolean }) {
  if (legend.type === "gradient") {
    return (
      <div>
        <div className="h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${legend.stops.join(",")})` }} />
        <div className="mt-1.5 flex justify-between text-[10px] text-subtle">
          {legend.labels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <ul className={compact ? "grid grid-cols-2 gap-x-3 gap-y-1" : "space-y-1"}>
      {legend.items.map((i) => (
        <li key={i.label} className="flex items-center gap-2 text-[11px] text-muted">
          <span className="size-2.5 shrink-0 rounded-sm ring-1 ring-white/10" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
