"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown, CircleCheck, CircleX, Clock, ServerCog } from "lucide-react";
import { useHealth } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { LiveDot } from "@/components/ui/live-dot";
import { isActive, NAV_ITEMS } from "./nav";

const subscribeSeconds = (tick: () => void) => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
};
const currentSecond = () => Math.floor(Date.now() / 1000);

function LiveClock() {
  // null on the server so the markup is deterministic; ticks every second on the client.
  const second = useSyncExternalStore(subscribeSeconds, currentSecond, () => null);
  const now = second != null ? new Date(second * 1000) : null;
  return (
    <span className="hidden items-center gap-2 rounded-lg border border-line bg-surface-2/60 px-3 py-1.5 font-mono text-xs text-muted tabular-nums sm:inline-flex">
      <Clock className="size-3.5" strokeWidth={2} aria-hidden />
      {now ? now.toLocaleTimeString("en-GB") : "--:--:--"}
      <span className="text-subtle">{now ? Intl.DateTimeFormat().resolvedOptions().timeZone.split("/").pop()?.replace("_", " ") : ""}</span>
    </span>
  );
}

const STATUS_STYLE = {
  operational: { label: "All systems operational", dot: "bg-ok", text: "text-ok" },
  degraded: { label: "Partial service degradation", dot: "bg-warn", text: "text-warn" },
  down: { label: "Data providers unreachable", dot: "bg-danger", text: "text-danger" },
} as const;

function StatusMenu() {
  const { data, error, isLoading } = useHealth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const status = data?.status ?? (error ? "down" : null);
  const style = status ? STATUS_STYLE[status] : null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface-2/60 px-3 py-1.5 text-xs font-medium transition-colors hover:border-line-strong"
      >
        {isLoading || !style ? (
          <span className="size-2 rounded-full bg-subtle" />
        ) : (
          <LiveDot color={style.dot} />
        )}
        <span className={cn("hidden md:inline", style?.text ?? "text-muted")}>{style?.label ?? "Checking services…"}</span>
        <span className="md:hidden">Status</span>
        <ChevronDown className="size-3.5 text-subtle" aria-hidden />
      </button>

      {open && (
        <div role="dialog" aria-label="Service status" className="absolute right-0 z-[1200] mt-2 w-72 rounded-xl border border-line-strong bg-surface p-3 shadow-2xl shadow-black/50">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
            <ServerCog className="size-4 text-accent" aria-hidden /> Data providers
          </div>
          <ul className="space-y-1.5">
            {data?.services.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-2.5 py-2 text-xs">
                <span className="flex items-center gap-2">
                  {s.ok ? <CircleCheck className="size-3.5 text-ok" aria-hidden /> : <CircleX className="size-3.5 text-danger" aria-hidden />}
                  {s.name}
                </span>
                <span className="font-mono text-subtle tabular-nums">{s.latencyMs != null ? `${s.latencyMs} ms` : "—"}</span>
              </li>
            ))}
            {!data && <li className="text-xs text-subtle">{error ? "Checking services…" : "Checking…"}</li>}
          </ul>
          {data && (
            <p className="mt-2 text-[10px] text-subtle">
              Checked {new Date(data.checkedAt).toLocaleTimeString("en-GB")} · v{data.version}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function Topbar() {
  const pathname = usePathname();
  const current = NAV_ITEMS.find((n) => isActive(n, pathname));

  return (
    <header className="sticky top-0 z-[1100] flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line bg-canvas/80 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/" aria-label="Urban Monitoring Platform — home" className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-white p-1 lg:hidden">
          <Image src="/brand/euromoonmars.png" alt="" width={28} height={34} className="h-7 w-auto" />
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] text-subtle">
            <Link href="/" className="hidden hover:text-fg sm:inline">
              Urban Monitoring Platform
            </Link>
            <span className="hidden sm:inline">/</span>
            <span className="truncate text-muted">{current?.label}</span>
          </div>
          <div className="truncate text-sm font-semibold">{current?.description ?? "Urban Monitoring Platform"}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <LiveClock />
        <StatusMenu />
      </div>
    </header>
  );
}
