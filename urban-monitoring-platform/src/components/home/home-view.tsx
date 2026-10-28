"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ArrowRight, Database, Flame, Globe2, Layers, LayoutDashboard, MapPin, Pickaxe, SatelliteDish, Sparkles, Trees } from "lucide-react";
import { useLocation } from "@/components/providers";
import { fetcher, useEnvironment } from "@/lib/client/api";
import { setIntent } from "@/lib/client/intent";
import { aqiBand } from "@/lib/aqi";
import type { Location } from "@/lib/data/types";
import { describeWeather } from "@/lib/weather";
import type { SensorStatus } from "@/lib/server/eo/status";
import { Flag } from "@/components/ui/flag";
import { LiveDot } from "@/components/ui/live-dot";
import { Skeleton } from "@/components/ui/skeleton";
import { LocationPicker } from "@/components/location/location-picker";

type Stats = {
  coverage: {
    countries: number;
    territories: number;
    states: number;
    cities: number;
    satelliteLayers: number;
  };
  fires: {
    last24h: number;
    countries: number;
    top: { iso2: string; name: string; count: number }[];
    latestAcquisition: string | null;
  } | null;
  sensors: SensorStatus[];
};

const nf = new Intl.NumberFormat("en-GB");

function ago(iso: string | null | undefined) {
  if (!iso) return "—";
  const h = (Date.now() - Date.parse(iso)) / 3_600_000;
  return h < 1 ? `${Math.max(1, Math.round(h * 60))} min ago` : h < 48 ? `${Math.round(h)} h ago` : `${Math.round(h / 24)} days ago`;
}

const MODULES = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    title: "City monitor",
    text: "Live weather, air quality and a 72-hour prediction for any city, with satellite view and national context.",
    tone: "text-accent bg-accent/10 border-accent/20",
  },
  {
    href: "/explorer",
    icon: SatelliteDish,
    title: "Satellite explorer",
    text: "15 live layers from Sentinel-1/2, Landsat 8/9, ALOS-2, Copernicus DEM and VIIRS, with before/after swipe.",
    tone: "text-violet bg-violet/10 border-violet/20",
  },
  {
    href: "/forests",
    icon: Trees,
    title: "Forests & fires",
    text: "Forest cover since 1990 for every country, loss and gain rankings, and active fires from the last 24 hours.",
    tone: "text-ok bg-ok/10 border-ok/20",
  },
  {
    href: "/zimbabwe",
    icon: Pickaxe,
    title: "Zimbabwe watch",
    text: "All 91 districts screened for land disturbance with Sentinel-2, Sentinel-1 and VIIRS, plus mapped mine sites.",
    tone: "text-warn bg-warn/10 border-warn/20",
  },
  {
    href: "/sources",
    icon: Database,
    title: "Data sources & status",
    text: "Every provider with its licence, refresh rate, live health check and latest satellite acquisition.",
    tone: "text-sky bg-sky/10 border-sky/20",
  },
];

export function HomeView() {
  const router = useRouter();
  const { location, select } = useLocation();
  // Poll until the (slow, cold-cache) fire and sensor figures have arrived.
  const { data: stats } = useSWR<Stats>("/api/stats", fetcher, {
    revalidateOnFocus: false,
    refreshInterval: (d) => (d?.fires && d.sensors.length ? 600_000 : 15_000),
  });
  const { data: env } = useEnvironment(location);
  const band = aqiBand(env?.aqi);
  const wx = describeWeather(env?.weatherCode ?? null);

  const open = (loc: Location) => {
    select(loc);
    router.push("/dashboard");
  };

  return (
    <div className="app-backdrop min-h-dvh">
      {/* ------------------------------------------------------------- top bar */}
      <header className="sticky top-0 z-[1100] border-b border-line bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white p-1">
              <Image src="/brand/euromoonmars.png" alt="EuroMoonMars" width={32} height={40} className="h-8 w-auto" priority />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold tracking-tight sm:text-base">Urban Monitoring Platform</span>
              <span className="hidden text-[11px] text-subtle sm:block">EuroMoonMars · Earth observation</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Modules">
            {MODULES.slice(0, 4).map((m) => (
              <Link key={m.href} href={m.href} className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg">
                {m.title.split(" &")[0]}
              </Link>
            ))}
          </nav>
          <Link
            href="/dashboard"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold whitespace-nowrap text-canvas transition-opacity hover:opacity-90 sm:px-4"
          >
            <span className="sm:hidden">Open</span>
            <span className="hidden sm:inline">Open platform</span> <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 pt-8 pb-10 sm:px-6 lg:pt-10">
        {/* ------------------------------------------------------------ hero */}
        <section className="grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:gap-8">
          <div className="flex flex-col justify-between gap-6">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Urban Monitoring <span className="bg-gradient-to-r from-accent via-sky to-ok bg-clip-text text-transparent">Platform</span>
              </h1>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
                Live environmental intelligence for every city on Earth — air quality, weather, satellite imagery, forests and fires — with predictions you can verify.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-canvas hover:opacity-90">
                  Monitor a city <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link href="/explorer" className="inline-flex items-center gap-2 rounded-xl border border-line-strong px-5 py-3 text-sm font-semibold hover:bg-surface-2">
                  <SatelliteDish className="size-4" aria-hidden /> Explore satellites
                </Link>
              </div>
            </div>

            {/* headline figures */}
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  k: stats ? `Countries · plus ${stats.coverage.territories} territories` : "Countries",
                  v: stats ? nf.format(stats.coverage.countries) : null,
                  icon: Globe2,
                },
                {
                  k: "States & provinces",
                  v: stats ? nf.format(stats.coverage.states) : null,
                  icon: Layers,
                },
                {
                  k: "Cities & towns",
                  v: stats ? nf.format(stats.coverage.cities) : null,
                  icon: MapPin,
                },
                {
                  k: "Active fires · 24 h",
                  v: stats?.fires ? nf.format(stats.fires.last24h) : null,
                  icon: Flame,
                },
              ].map((s) => (
                <div key={s.k} className="rounded-2xl border border-line bg-surface/70 p-4">
                  <s.icon className="size-5 text-accent" aria-hidden />
                  <div className="mt-2 font-mono text-2xl font-semibold tracking-tight sm:text-3xl">{s.v ?? <Skeleton className="h-9 w-24" />}</div>
                  <div className="mt-0.5 text-sm text-muted">{s.k}</div>
                </div>
              ))}
            </div>
          </div>

          {/* live card */}
          <div className="rounded-3xl border border-line bg-surface/80 p-6 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-subtle uppercase">Right now</span>
              <span className="inline-flex items-center gap-1.5 text-xs text-ok">
                <LiveDot /> live
              </span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Flag iso2={location.iso2.toLowerCase()} className="h-8 w-11 rounded" />
              <div>
                <div className="text-xl font-semibold">{location.name}</div>
                <div className="text-sm text-muted">{[location.state, location.country].filter(Boolean).join(", ")}</div>
              </div>
            </div>
            {env ? (
              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-surface-2/80 p-3">
                  <wx.icon className="size-5 text-warn" aria-hidden />
                  <div className="mt-2 font-mono text-2xl font-semibold">{env.temperature?.toFixed(1)}°</div>
                  <div className="text-[11px] text-subtle">{wx.label}</div>
                </div>
                <div className="rounded-2xl bg-surface-2/80 p-3">
                  <Sparkles className="size-5" style={{ color: band.color }} aria-hidden />
                  <div className="mt-2 font-mono text-2xl font-semibold" style={{ color: band.color }}>
                    {env.aqi ?? "—"}
                  </div>
                  <div className="text-[11px] text-subtle">AQI · {band.label}</div>
                </div>
                <div className="rounded-2xl bg-surface-2/80 p-3">
                  <MapPin className="size-5 text-accent" aria-hidden />
                  <div className="mt-2 font-mono text-2xl font-semibold">{env.humidity ?? "—"}%</div>
                  <div className="text-[11px] text-subtle">Humidity</div>
                </div>
              </div>
            ) : (
              <Skeleton className="mt-5 h-28 w-full rounded-2xl" />
            )}
            <div className="relative z-20 mt-5 border-t border-line pt-5">
              <LocationPicker value={location} onSelect={open} layout="stack" />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- modules */}
        <section>
          <h2 className="text-2xl font-semibold tracking-tight">Everything on the platform</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {MODULES.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className="group flex flex-col rounded-2xl border border-line bg-surface/70 p-5 transition-all last:sm:col-span-2 hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface lg:last:col-span-1"
              >
                <span className={`grid size-11 place-items-center rounded-xl border ${m.tone}`}>
                  <m.icon className="size-5" strokeWidth={1.75} aria-hidden />
                </span>
                <h3 className="mt-3 text-base font-semibold">{m.title}</h3>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">{m.text}</p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                  Open <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ----------------------------------------------------- live sensors */}
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface/70 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <SatelliteDish className="size-5 text-accent" aria-hidden /> Latest satellite passes
            </h2>
            <ul className="mt-4 space-y-2">
              {!stats?.sensors.length && <Skeleton className="h-64 w-full" />}
              {stats?.sensors.map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded-xl bg-surface-2/70 px-4 py-3 text-sm">
                  <span>
                    <span className="block font-medium">{s.name}</span>
                    <span className="block text-xs text-subtle">{s.role}</span>
                  </span>
                  <span className="font-mono text-xs text-muted">{ago(s.latest)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-line bg-surface/70 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Flame className="size-5 text-alert" aria-hidden /> Where fires are burning now
            </h2>
            <p className="mt-1 text-xs text-subtle">
              NASA VIIRS detections, last 24 h · {stats?.fires ? `${stats.fires.countries} countries · latest pass ${ago(stats.fires.latestAcquisition)}` : "loading"}
            </p>
            <ul className="mt-4 space-y-2">
              {!stats?.fires && <Skeleton className="h-64 w-full" />}
              {stats?.fires?.top.map((f) => (
                <li key={f.iso2}>
                  <Link
                    href="/forests"
                    onClick={() => setIntent("forests", { iso2: f.iso2 })}
                    className="flex items-center gap-3 rounded-xl bg-surface-2/70 px-4 py-3 text-sm hover:bg-surface-3"
                  >
                    <Flag iso2={f.iso2.toLowerCase()} className="h-4 w-6" />
                    <span className="flex-1 font-medium">{f.name}</span>
                    <span className="font-mono text-alert">{nf.format(f.count)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
