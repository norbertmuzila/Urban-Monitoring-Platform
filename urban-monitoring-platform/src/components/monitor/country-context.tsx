"use client";

import Link from "next/link";
import { ExternalLink, Flame, Globe2 } from "lucide-react";
import { useCountryProfile } from "@/lib/client/api";
import type { IndicatorKey } from "@/lib/server/worldbank";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Flag } from "@/components/ui/flag";
import { Skeleton } from "@/components/ui/skeleton";

const SHOW: { key: IndicatorKey; format: (v: number) => string }[] = [
  { key: "population", format: (v) => new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(v) },
  { key: "urbanPct", format: (v) => `${v.toFixed(1)}%` },
  { key: "pm25", format: (v) => `${v.toFixed(1)} µg/m³` },
  { key: "forestPct", format: (v) => `${v.toFixed(1)}%` },
  { key: "protectedPct", format: (v) => `${v.toFixed(1)}%` },
  { key: "co2PerCapita", format: (v) => `${v.toFixed(2)} t` },
];

/** National context from the World Bank (each figure links to its source page) plus live fires. */
export function CountryContext({ iso2, name }: { iso2: string; name: string }) {
  const { data, error } = useCountryProfile(iso2);
  return (
    <Card>
      <CardHeader
        icon={Globe2}
        title={`${name} at a glance`}
        subtitle="World Bank development indicators · click a figure to verify"
        action={<Flag iso2={iso2.toLowerCase()} className="h-4 w-6" />}
      />
      <CardBody className="space-y-3">
        {error && !data && <p className="text-xs text-muted">World Bank data could not be loaded right now — it will retry automatically.</p>}
        {!data && !error && <Skeleton className="h-40 w-full" />}
        {data && SHOW.every(({ key }) => !data.indicators.indicators[key].latest) && (
          <p className="rounded-xl bg-surface-2/70 px-3 py-2.5 text-xs text-muted">
            The World Bank does not publish development indicators for {name} (it is reported as part of another economy or not covered).
          </p>
        )}
        {data && (
          <>
            <div className={SHOW.some(({ key }) => data.indicators.indicators[key].latest) ? "grid grid-cols-2 gap-2" : "hidden"}>
              {SHOW.map(({ key, format }) => {
                const s = data.indicators.indicators[key];
                return (
                  <a
                    key={key}
                    href={s.verifyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group rounded-xl bg-surface-2/70 px-3 py-2.5 transition-colors hover:bg-surface-3"
                    title={`${s.label} — ${s.id}`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-subtle">
                      <span className="truncate">{s.label}</span>
                      <ExternalLink className="size-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                    </div>
                    <div className="mt-0.5 font-mono text-base font-semibold">{s.latest ? format(s.latest.value) : "—"}</div>
                    <div className="text-[10px] text-subtle">{s.latest ? s.latest.year : "no data"}</div>
                  </a>
                );
              })}
            </div>
            {data.fires && (
              <div className="flex items-center justify-between rounded-xl border border-alert/20 bg-alert/[0.05] px-3 py-2.5 text-xs">
                <span className="flex items-center gap-2">
                  <Flame className="size-4 text-alert" aria-hidden />
                  <span>
                    <strong className="font-mono">{data.fires.last24h.toLocaleString("en-GB")}</strong> active fires detected in the last 24 h
                  </span>
                </span>
                <Link href={`/forests?country=${iso2}`} className="text-accent hover:underline">
                  Forests & fires →
                </Link>
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
