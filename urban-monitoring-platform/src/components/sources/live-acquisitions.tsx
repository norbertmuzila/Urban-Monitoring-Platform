"use client";

import { CircleCheck, CircleX, Flame, Radar, Satellite, ThermometerSun } from "lucide-react";
import { useEoStatus } from "@/lib/client/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ICONS = { s2: Satellite, s1: Radar, landsat: ThermometerSun, viirs: Flame } as const;

function ago(iso: string) {
  const h = (Date.now() - Date.parse(iso)) / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min ago`;
  if (h < 48) return `${Math.round(h)} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

/** Real latest acquisitions per sensor over the study areas (STAC + FIRMS). */
export function LiveAcquisitions() {
  const { data, error } = useEoStatus();
  return (
    <Card>
      <CardHeader
        icon={Satellite}
        title="Live satellite acquisitions"
        subtitle={data ? `Latest scene per sensor over ${data.areas.join(", ")}` : "Querying STAC catalogues…"}
        action={
          <Badge tone="ok" live>
            Real data
          </Badge>
        }
      />
      <CardBody>
        {error && !data && <p className="text-xs text-danger">Sensor status unavailable.</p>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {!data && !error && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          {data?.sensors.map((s) => {
            const Icon = ICONS[s.id as keyof typeof ICONS] ?? Satellite;
            return (
              <div key={s.id} className="rounded-xl border border-line bg-surface-2/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-semibold">
                    <Icon className="size-4 text-accent" aria-hidden /> {s.name}
                  </span>
                  {s.ok ? <CircleCheck className="size-4 text-ok" aria-label="online" /> : <CircleX className="size-4 text-danger" aria-label="unavailable" />}
                </div>
                <div className="mt-2 font-mono text-sm">{s.latest ? ago(s.latest) : "—"}</div>
                <div className="text-[11px] text-subtle">
                  {s.latest ? `${new Date(s.latest).toLocaleString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} UTC` : "no recent scene"}
                  {s.platform ? ` · ${s.platform}` : ""}
                </div>
                <div className="mt-1.5 text-[11px] text-muted">{s.role}</div>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
