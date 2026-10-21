import { cn } from "@/lib/cn";

export function LiveDot({ className, color = "bg-ok" }: { className?: string; color?: string }) {
  return (
    <span className={cn("relative inline-flex size-2", className)} aria-hidden>
      <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60", color)} />
      <span className={cn("relative inline-flex size-full rounded-full", color)} />
    </span>
  );
}
