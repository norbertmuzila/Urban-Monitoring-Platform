"use client";

import { Building2 } from "lucide-react";
import { useCountryCitiesLive } from "@/lib/client/api";
import type { Location } from "@/lib/data/types";
import { aqiBand } from "@/lib/aqi";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const nf = new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 });

/** Live conditions in the country's largest cities — click one to monitor it. */
export function CountryCities({ location, onSelect }: { location: Location; onSelect: (l: Location) => void }) {
  const { data } = useCountryCitiesLive(location.iso2);
  const maxAqi = Math.max(1, ...(data?.cities.map((c) => c.aqi ?? 0) ?? [1]));

  return (
    <Card>
      <CardHeader icon={Building2} title={`Largest cities in ${location.country}`} subtitle="Live European AQI and temperature — click to switch" action={<Badge tone="ok" live>Live</Badge>} />
      <CardBody>
        {!data ? (
          <Skeleton className="h-64 w-full" />
        ) : data.cities.length === 0 ? (
          <p className="text-sm text-muted">No cities above 1,000 inhabitants are listed for this country.</p>
        ) : (
          <ul className="space-y-1.5">
            {data.cities.map((c) => {
              const band = aqiBand(c.aqi);
              const active = c.id === location.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect({ id: c.id, name: c.name, state: c.state || null, country: location.country, iso2: location.iso2, lat: c.lat, lng: c.lng, population: c.population })}
                    className={cn(
                      "grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-left transition-colors sm:grid-cols-[180px_1fr_auto_auto]",
                      active ? "bg-accent/10 ring-1 ring-accent/30" : "hover:bg-surface-2",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{c.name}</span>
                      <span className="block truncate text-[11px] text-subtle">
                        {c.state} · {nf.format(c.population)}
                      </span>
                    </span>
                    <span className="hidden h-2 overflow-hidden rounded-full bg-surface-3 sm:block">
                      <span className="block h-full rounded-full" style={{ width: `${((c.aqi ?? 0) / maxAqi) * 100}%`, background: band.color }} />
                    </span>
                    <span className="text-right font-mono text-xs" style={{ color: band.color }}>
                      {c.aqi ?? "—"} <span className="text-subtle">AQI</span>
                    </span>
                    <span className="hidden text-right font-mono text-xs text-muted sm:block">{c.temperature != null ? `${c.temperature.toFixed(1)}°C` : "—"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
