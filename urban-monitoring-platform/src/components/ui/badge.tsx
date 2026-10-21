import { cn } from "@/lib/cn";
import { LiveDot } from "./live-dot";

const tones = {
  neutral: "border-line bg-surface-2 text-muted",
  accent: "border-accent/25 bg-accent/10 text-accent",
  ok: "border-ok/25 bg-ok/10 text-ok",
  warn: "border-warn/25 bg-warn/10 text-warn",
  danger: "border-danger/25 bg-danger/10 text-danger",
  violet: "border-violet/25 bg-violet/10 text-violet",
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({
  tone = "neutral",
  live,
  className,
  children,
}: {
  tone?: BadgeTone;
  live?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
        className,
      )}
    >
      {live && <LiveDot className="size-1.5" />}
      {children}
    </span>
  );
}
