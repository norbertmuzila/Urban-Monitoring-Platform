"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Satellite } from "lucide-react";
import { cn } from "@/lib/cn";
import { isActive, NAV_ITEMS } from "./nav";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface/70 backdrop-blur-xl lg:flex">
      <Link href="/" className="flex h-16 items-center gap-3 border-b border-line px-5 transition-colors hover:bg-surface-2/60" aria-label="Urban Monitoring Platform — home">
        <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white p-1 shadow-[0_0_0_1px_rgb(255_255_255/0.2)]">
          <Image src="/brand/euromoonmars.png" alt="" width={32} height={40} className="h-8 w-auto" priority />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block text-sm font-semibold tracking-tight">Urban Monitoring Platform</span>
          <span className="block text-[11px] text-subtle">EuroMoonMars · Earth observation</span>
        </span>
      </Link>

      <nav aria-label="Primary" className="flex-1 space-y-1 p-3">
        <div className="px-2 pt-2 pb-2 text-[10px] font-semibold tracking-[0.12em] text-subtle uppercase">Workspace</div>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "bg-accent/10 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <item.icon className={cn("size-[18px] shrink-0", active ? "text-accent" : "text-subtle group-hover:text-muted")} strokeWidth={1.75} aria-hidden />
              <span className="min-w-0">
                <span className="block truncate font-medium">{item.label}</span>
                <span className="block truncate text-[11px] text-subtle">{item.description}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="m-3 rounded-xl border border-line bg-surface-2/60 p-3">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Satellite className="size-4 text-accent" strokeWidth={1.75} aria-hidden />
          Open Earth observation
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-subtle">Copernicus, NASA, USGS, JAXA, ECMWF and World Bank data — every figure links to its source.</p>
        <div className="mt-3 flex items-center justify-center rounded-lg bg-white px-2 py-1.5">
          <Image src="/brand/eurospacehub.png" alt="EuroSpaceHub" width={140} height={40} className="h-6 w-auto" />
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-[1100] grid grid-cols-6 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(item, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn("flex flex-col items-center gap-1 py-2 text-[10px] font-medium", active ? "text-accent" : "text-subtle")}
          >
            <item.icon className="size-5" strokeWidth={1.75} aria-hidden />
            {item.short}
          </Link>
        );
      })}
    </nav>
  );
}
