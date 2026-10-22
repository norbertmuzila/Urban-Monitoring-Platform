"use client";

import { CircleCheck, CircleX, Database, ExternalLink, ServerCog } from "lucide-react";
import { useHealth } from "@/lib/client/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { DATA_SOURCES } from "@/lib/data/sources";
import { LiveAcquisitions } from "./live-acquisitions";

export function SourcesView() {
  const { data: health } = useHealth();
  return (
    <>
      <PageHeader
        title="Data sources & status"
        description="Every figure on this platform comes from an open, citable source, with live service checks."
        actions={
          health && (
            <Badge tone={health.status === "operational" ? "ok" : health.status === "degraded" ? "warn" : "danger"} live>
              {health.status === "operational" ? "All services operational" : health.status}
            </Badge>
          )
        }
      />

      <LiveAcquisitions />

      <Card>
        <CardHeader icon={ServerCog} title="Live service health" subtitle={health ? `Checked ${new Date(health.checkedAt).toLocaleTimeString("en-GB")}` : "Checking…"} />
        <CardBody>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {!health && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            {health?.services.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl bg-surface-2/70 px-3 py-3 text-xs">
                <span className="flex items-center gap-2">
                  {s.ok ? <CircleCheck className="size-4 text-ok" aria-hidden /> : <CircleX className="size-4 text-danger" aria-hidden />}
                  {s.name}
                </span>
                <span className="font-mono text-subtle">{s.latencyMs != null ? `${s.latencyMs} ms` : "—"}</span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader icon={Database} title="Data catalogue" subtitle={`${DATA_SOURCES.length} open sources · no API keys required`} />
        <CardBody className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead>
              <tr className="text-left text-[10px] tracking-wider text-subtle uppercase">
                <th className="pb-2 font-medium">Source</th>
                <th className="pb-2 font-medium">Used for</th>
                <th className="pb-2 font-medium">Refresh</th>
                <th className="pb-2 font-medium">Licence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {DATA_SOURCES.map((s) => (
                <tr key={s.name}>
                  <td className="py-2.5 pr-3">
                    <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-fg hover:text-accent">
                      {s.name} <ExternalLink className="size-3 text-subtle" aria-hidden />
                    </a>
                  </td>
                  <td className="py-2.5 pr-3 text-muted">{s.use}</td>
                  <td className="py-2.5 pr-3 text-muted">{s.refresh}</td>
                  <td className="py-2.5 text-muted">{s.license}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </>
  );
}
