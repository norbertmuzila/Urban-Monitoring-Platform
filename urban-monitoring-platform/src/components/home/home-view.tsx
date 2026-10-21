"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  ArrowRight,
  BadgeCheck,
  Brain,
  Database,
  Flame,
  Globe2,
  Layers,
  LayoutDashboard,
  MapPin,
  Pickaxe,
  SatelliteDish,
  ServerCog,
  Sparkles,
  Telescope,
  Trees,
} from "lucide-react";
import { useLocation } from "@/components/providers";
import { fetcher, useEnvironment } from "@/lib/client/api";
import { aqiBand } from "@/lib/aqi";
import type { Location } from "@/lib/data/types";
import { describeWeather } from "@/lib/weather";
import type { SensorStatus } from "@/lib/server/eo/status";
import { Flag } from "@/components/ui/flag";
import { LiveDot } from "@/components/ui/live-dot";
import { Skeleton } from "@/components/ui/skeleton";
import { LocationPicker } from "@/components/location/location-picker";
import { DATA_SOURCES } from "@/lib/data/sources";

type Stats = {
  coverage: { countries: number; states: number; cities: number; satelliteLayers: number };
  fires: { last24h: number; countries: number; top: { iso2: string; name: string; count: number }[]; latestAcquisition: string | null } | null;
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
    text: "Pick any country, state and city. Live weather and air quality, a 72-hour prediction with measured accuracy, satellite view and national context.",
    tone: "text-accent bg-accent/10 border-accent/20",
  },
  {
    href: "/explorer",
    icon: SatelliteDish,
    title: "Satellite explorer",
    text: "15 live layers from Sentinel-1/2, Landsat 8/9, ALOS-2, Copernicus DEM and VIIRS — with before/after comparison to reveal change.",
    tone: "text-violet bg-violet/10 border-violet/20",
  },
  {
    href: "/forests",
    icon: Trees,
    title: "Forests & fires",
    text: "Forest cover trends since 1990 for every country, global loss and gain rankings, and NASA active-fire detections from the last 24 hours.",
    tone: "text-ok bg-ok/10 border-ok/20",
  },
  {
    href: "/chipinge",
    icon: Telescope,
    title: "Chipinge observatory",
    text: "The featured project: live year-on-year satellite monitoring of 7 forest sites, 10 m land-cover change since 2017, fires and fire weather in Chipinge District.",
    tone: "text-ok bg-ok/10 border-ok/20",
  },
  {
    href: "/zimbabwe",
    icon: Pickaxe,
    title: "Zimbabwe land & mining watch",
    text: "All 91 districts screened for land disturbance with Sentinel-2, Sentinel-1 and VIIRS, alongside mapped mine sites.",
    tone: "text-warn bg-warn/10 border-warn/20",
  },
  {
    href: "/sources",
    icon: Database,
    title: "Data sources & status",
    text: "Every provider, its licence and refresh rate, with live health checks and the latest satellite acquisition per sensor.",
    tone: "text-sky bg-sky/10 border-sky/20",
  },
];

const STEPS = [
  { icon: Globe2, title: "Open data in", text: "Copernicus, NASA, USGS, JAXA, ESA, ECMWF, World Bank and GeoNames — fetched live, no keys." },
  { icon: ServerCog, title: "Validated & cached", text: "A typed serverless backend validates every request and caches results at the edge." },
  { icon: Brain, title: "Models in the background", text: "Per-location models are retrained hourly on 92 days of history and scored on unseen data." },
  { icon: BadgeCheck, title: "Verifiable out", text: "Each figure links to the exact upstream request, so anyone can check it." },
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
    router.push(`/dashboard?place=${loc.id}&lat=${loc.lat}&lng=${loc.lng}&name=${encodeURIComponent(loc.name)}&iso2=${loc.iso2}`);
  };

  return (
    <div className="app-backdrop min-h-dvh">
      {/* ------------------------------------------------------------- top bar */}
      <header className="sticky top-0 z-[1100] border-b border-line bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center overflow-hidden rounded-xl bg-white p-1">
              <Image src="/brand/euromoonmars.png" alt="EuroMoonMars" width={32} height={40} className="h-8 w-auto" priority />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold tracking-tight sm:text-base">Urban Monitoring Platform</span>
              <span className="block text-[11px] text-subtle">EuroMoonMars · Earth observation</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Modules">
            {MODULES.slice(0, 5).map((m) => (
              <Link key={m.href} href={m.href} className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg">
                {m.title.split(" &")[0].replace(" land", "").replace(" observatory", "")}
              </Link>
            ))}
          </nav>
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-canvas transition-opacity hover:opacity-90">
            Open platform <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-20 px-4 pt-14 pb-16 sm:px-6">
        {/* ------------------------------------------------------------ hero */}
        <section className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-ok/25 bg-ok/10 px-3 py-1 text-xs font-medium text-ok">
              <LiveDot /> Live data from {DATA_SOURCES.length} open sources
            </span>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Urban Monitoring <span className="bg-gradient-to-r from-accent via-sky to-ok bg-clip-text text-transparent">Platform</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
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

        {/* ---------------------------------------------------------- figures */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { k: "Countries & territories", v: stats ? nf.format(stats.coverage.countries) : null, icon: Globe2 },
            { k: "States & provinces", v: stats ? nf.format(stats.coverage.states) : null, icon: Layers },
            { k: "Cities & towns listed", v: stats ? nf.format(stats.coverage.cities) : null, icon: MapPin },
            { k: "Active fires worldwide · 24 h", v: stats?.fires ? nf.format(stats.fires.last24h) : null, icon: Flame },
          ].map((s) => (
            <div key={s.k} className="rounded-2xl border border-line bg-surface/70 p-5">
              <s.icon className="size-5 text-accent" aria-hidden />
              <div className="mt-3 font-mono text-3xl font-semibold tracking-tight">{s.v ?? <Skeleton className="h-9 w-24" />}</div>
              <div className="mt-1 text-sm text-muted">{s.k}</div>
            </div>
          ))}
        </section>

        {/* ---------------------------------------------------------- modules */}
        <section>
          <h2 className="text-2xl font-semibold tracking-tight">Everything on the platform</h2>
          <p className="mt-2 max-w-2xl text-muted">Six connected workspaces, all driven by live, open Earth-observation and environmental data.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {MODULES.map((m) => (
              <Link key={m.href} href={m.href} className="group rounded-2xl border border-line bg-surface/70 p-6 transition-all hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface">
                <span className={`grid size-11 place-items-center rounded-xl border ${m.tone}`}>
                  <m.icon className="size-5" strokeWidth={1.75} aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{m.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{m.text}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                  Open <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ----------------------------------------------------- live sensors */}
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface/70 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <SatelliteDish className="size-5 text-accent" aria-hidden /> Latest satellite passes
            </h2>
            <ul className="mt-4 space-y-2">
              {!stats && <Skeleton className="h-40 w-full" />}
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
              {!stats && <Skeleton className="h-40 w-full" />}
              {stats?.fires?.top.map((f) => (
                <li key={f.iso2}>
                  <Link href={`/forests?country=${f.iso2}`} className="flex items-center gap-3 rounded-xl bg-surface-2/70 px-4 py-3 text-sm hover:bg-surface-3">
                    <Flag iso2={f.iso2.toLowerCase()} className="h-4 w-6" />
                    <span className="flex-1 font-medium">{f.name}</span>
                    <span className="font-mono text-alert">{nf.format(f.count)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------ how it works */}
        <section>
          <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative rounded-2xl border border-line bg-surface/70 p-6">
                <span className="absolute top-5 right-5 font-mono text-xs text-subtle">0{i + 1}</span>
                <s.icon className="size-6 text-accent" strokeWidth={1.75} aria-hidden />
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted">
            <strong className="text-fg">On accuracy:</strong> no measurement or forecast is perfect. Instead of claiming certainty, the platform shows where each number
            comes from and, for predictions, how large the error has actually been at that location over the last 14 days.
          </p>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-xs text-subtle sm:flex-row sm:px-6">
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-white px-2 py-1">
              <Image src="/brand/eurospacehub.png" alt="EuroSpaceHub" width={120} height={34} className="h-5 w-auto" />
            </span>
            <span>Urban Monitoring Platform · EuroMoonMars research programme</span>
          </div>
          <span>Data © Copernicus/ESA, NASA, USGS, JAXA, ECMWF, World Bank, GeoNames, OpenStreetMap contributors</span>
        </div>
      </footer>
    </div>
  );
}
