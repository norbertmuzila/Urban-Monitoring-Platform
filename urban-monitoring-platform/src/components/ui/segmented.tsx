"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "sm",
  className,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: LucideIcon }[];
  size?: "sm" | "xs";
  className?: string;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex rounded-lg border border-line bg-surface/90 p-0.5 backdrop-blur", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors",
              size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-2 py-1 text-[11px]",
              active ? "bg-surface-3 text-fg shadow-sm" : "text-muted hover:text-fg",
            )}
          >
            {o.icon && <o.icon className="size-3.5" strokeWidth={2} aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
