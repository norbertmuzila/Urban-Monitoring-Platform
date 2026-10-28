"use client";

import { useEffect, useState } from "react";
import { Clock, Droplets, ExternalLink, FlaskConical, Gauge, MapPin, Navigation, Thermometer, Users, Wind, X } from "lucide-react";
import { Bar } from "react-chartjs-2";
import { useLocation } from "@/components/providers";
import { useEnvironment } from "@/lib/client/api";
import { cleanAddressBar } from "@/lib/client/intent";
import { aqiBand, AQI_LEGEND } from "@/lib/aqi";
import type { Location } from "@/lib/data/types";
import { cn } from "@/lib/cn";
import { fmt, palette } from "@/lib/format";
import { compass, describeWeather, pm25Band, wallClock } from "@/lib/weather";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Flag } from "@/components/ui/flag";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { cartesian } from "@/components/charts/setup";
import { LocationPicker } from "@/components/location/location-picker";
import { CitySatellite } from "./city-satellite";
import { CountryCities } from "./country-cities";
import { CountryContext } from "./country-context";
import { PredictionsPanel } from "./predictions-panel";
import { PanelBoundary } from "@/components/ui/panel-boundary";

const POLLUTANTS = [
  { key: "pm25", label: "PM2.5", color: palette.violet },
  { key: "pm10", label: "PM10", color: palette.accent },
  { key: "no2", label: "NO₂", color: palette.danger },
  { key: "o3", label: "O₃", color: palette.ok },
  { key: "so2", label: "SO₂", color: palette.alert },
] as const;

export function MonitorView({ initial }: { initial: Location | null }) {
  const { location, recent, select, forget } = useLocation();
  // A location from an old shared link wins over the stored one, once; the address is then tidied to /dashboard.
  const [applied, setApplied] = useState(false);
  useEffect(() => {
    if (applied) return;
    if (initial) select(initial);
    cleanAddressBar();
    setApplied(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, [applied, initial, select]);

  const { data: env, error, isLoading, mutate } = useEnvironment(location);
  const band = aqiBand(env?.aqi);
  const wx = describeWeather(env?.weatherCode ?? null);
  const loading = isLoading && !env;

  return (
    <>
      {/* -------------------------------------------------------------- picker */}
      <Card className="relative z-20">
        <CardBody className="space-y-4 pt-5">
          <LocationPicker value={location} onSelect={select} autoSelect />
          {recent.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] text-subtle">Recent</span>
              {recent.map((r) => (
                <span
                  key={r.id}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border py-1 pr-1 pl-2 text-xs",
                    r.id === location.id ? "border-accent/40 bg-accent/10" : "border-line bg-surface-2/60 hover:border-line-strong",
                  )}
                >
                  <button type="button" onClick={() => select(r)} className="inline-flex items-center gap-1.5">
                    <Flag iso2={r.iso2.toLowerCase()} className="h-3 w-4" />
                    {r.name}
                  </button>
                  {r.id !== location.id && (
                    <button
                      type="button"
                      onClick={() => forget(r)}
                      aria-label={`Remove ${r.name}`}
                      className="rounded p-0.5 text-subtle hover:bg-surface-3 hover:text-fg"
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* ---------------------------------------------------------------- hero */}
      <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-gradient-to-br from-accent/[0.07] via-surface/80 to-surface/80 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Flag iso2={location.iso2.toLowerCase()} className="h-10 w-14 rounded-md" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{location.name}</h1>
            <p className="text-sm text-muted">{[location.state, location.country].filter(Boolean).join(", ")}</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-subtle">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" aria-hidden /> {location.lat.toFixed(3)}°, {location.lng.toFixed(3)}°
              </span>
              {location.population ? (
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3" aria-hidden /> {fmt.int(location.population)} people
                </span>
              ) : null}
              {env?.timezone && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" aria-hidden /> {env.timezone} · observed {wallClock(env.observedAt, { hour: "2-digit", minute: "2-digit" })} local
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {env && (
            <div className="flex items-center gap-3">
              <wx.icon className="size-10 text-warn" strokeWidth={1.5} aria-hidden />
              <div>
                <div className="font-mono text-3xl font-semibold">{fmt.dp(env.temperature)}°</div>
                <div className="text-xs text-muted">{wx.label}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && !env && (
        <Card>
          <ErrorState message="Live conditions are refreshing for this location." onRetry={() => mutate()} />
        </Card>
      )}

      {/* --------------------------------------------------------------- KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          icon={Thermometer}
          tone="alert"
          label="Temperature"
          value={fmt.dp(env?.temperature)}
          unit="°C"
          hint={env?.apparentTemperature != null ? `Feels like ${env.apparentTemperature.toFixed(1)} °C` : undefined}
          loading={loading}
        />
        <StatCard icon={Gauge} tone="danger" label="Air quality" value={env?.aqi ?? "—"} valueColor={band.color} hint={`EAQI · ${band.label}`} loading={loading} />
        <StatCard
          icon={FlaskConical}
          tone="violet"
          label="PM2.5"
          value={fmt.dp(env?.pollutants.pm25)}
          unit="µg/m³"
          valueColor={pm25Band(env?.pollutants.pm25 ?? null)?.color}
          hint={pm25Band(env?.pollutants.pm25 ?? null)?.label}
          loading={loading}
        />
        <StatCard
          icon={Droplets}
          tone="accent"
          label="Humidity"
          value={fmt.int(env?.humidity)}
          unit="%"
          hint={env?.precipitation ? `${env.precipitation} mm rain now` : `${fmt.int(env?.cloudCover)}% cloud cover`}
          loading={loading}
        />
        <StatCard
          icon={Wind}
          tone="sky"
          label="Wind"
          value={fmt.dp(env?.windSpeed)}
          unit="km/h"
          hint={env?.windDirection != null ? `From ${compass(env.windDirection)} (${Math.round(env.windDirection)}°)` : undefined}
          loading={loading}
        />
        <StatCard icon={Navigation} tone="ok" label="Pressure" value={fmt.int(env?.pressure)} unit="hPa" hint="Surface pressure" loading={loading} />
      </div>

      {/* --------------------------------------------------------- prediction */}
      <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
        <PanelBoundary label="The prediction">
          <PredictionsPanel location={location} />
        </PanelBoundary>
        <div className="space-y-5">
          <Card>
            <CardHeader icon={FlaskConical} title="Pollutant mix right now" subtitle="Surface concentrations, µg/m³" action={<Badge tone="accent">CAMS</Badge>} />
            <CardBody className="h-56">
              {env ? (
                <Bar
                  data={{
                    labels: POLLUTANTS.map((p) => p.label),
                    datasets: [
                      {
                        label: "µg/m³",
                        data: POLLUTANTS.map((p) => env.pollutants[p.key]),
                        backgroundColor: POLLUTANTS.map((p) => p.color),
                        borderRadius: 6,
                        maxBarThickness: 40,
                      },
                    ],
                  }}
                  options={cartesian({ legend: false }) as never}
                />
              ) : (
                <Skeleton className="size-full" />
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader icon={Gauge} title="European AQI scale" />
            <CardBody className="space-y-1.5">
              {AQI_LEGEND.map((b) => (
                <div
                  key={b.label}
                  className={cn(
                    "flex items-center justify-between rounded-md px-2 py-1 text-xs",
                    env && aqiBand(env.aqi).label === b.label && "bg-surface-3 ring-1 ring-line-strong",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: b.color }} />
                    {b.label}
                  </span>
                  <span className="font-mono text-subtle">{Number.isFinite(b.max) ? `${b.from}–${b.max}` : `> ${b.from}`}</span>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <PanelBoundary label="The satellite view">
          <CitySatellite location={location} />
        </PanelBoundary>
        <PanelBoundary label="The city list">
          <CountryCities location={location} onSelect={select} />
        </PanelBoundary>
      </div>

      <PanelBoundary label="The country overview">
        <CountryContext iso2={location.iso2} name={location.country} />
      </PanelBoundary>

      {env && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-subtle">
          <span>Verify live readings:</span>
          {env.sources.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
              <ExternalLink className="size-3" aria-hidden /> {s.label}
            </a>
          ))}
        </div>
      )}
    </>
  );
}
