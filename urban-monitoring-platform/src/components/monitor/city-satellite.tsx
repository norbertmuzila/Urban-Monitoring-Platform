"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ExternalLink, SatelliteDish } from "lucide-react";
import { useEoTiles } from "@/lib/client/api";
import { setIntent } from "@/lib/client/intent";
import type { Location } from "@/lib/data/types";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { EoLegendView } from "@/components/eo/eo-legend";

const EoMapCanvas = dynamic(() => import("@/components/eo/eo-map-canvas"), { ssr: false, loading: () => <Skeleton className="size-full rounded-none" /> });

const LAYERS = [
  { value: "truecolor", label: "Imagery" },
  { value: "ndvi", label: "Vegetation" },
  { value: "lst", label: "Heat" },
  { value: "ndbi", label: "Built-up" },
  { value: "s1-vh", label: "Radar" },
];

/** Live Sentinel/Landsat view of the selected city. */
export function CitySatellite({ location }: { location: Location }) {
  const [layer, setLayer] = useState("truecolor");
  const end = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const days = layer === "lst" ? 90 : 60;
  const tiles = useEoTiles(layer, days, end);
  const target = useMemo(() => ({ lat: location.lat, lng: location.lng, zoom: 12 }), [location.lat, location.lng]);

  return (
    <Card>
      <CardHeader
        icon={SatelliteDish}
        title="Satellite view"
        subtitle={tiles.data ? `${tiles.data.layer.sensor} · clearest scenes, last ${days} days` : "Loading…"}
        action={<Segmented label="Satellite layer" size="xs" value={layer} onChange={setLayer} options={LAYERS} />}
      />
      <CardBody className="space-y-3">
        <div className="relative h-80 overflow-hidden rounded-xl border border-line">
          <EoMapCanvas
            basemap="dark"
            target={target}
            after={tiles.data ? { url: tiles.data.tileUrl, maxNativeZoom: tiles.data.maxNativeZoom, minZoom: tiles.data.layer.minZoom ?? 0, attribution: tiles.data.layer.attribution } : null}
            before={null}
            ratio={0.5}
            opacity={0.95}
            onView={() => {}}
          />
          {tiles.data?.layer.legend && (
            <div className="absolute bottom-2 left-2 z-[1000] w-52 rounded-lg border border-line-strong bg-surface/95 p-2.5 backdrop-blur">
              <EoLegendView legend={tiles.data.layer.legend} compact />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 text-[11px] text-subtle">
          <span className="truncate">{tiles.data?.layer.detects}</span>
          <Link
            href="/explorer"
            onClick={() => setIntent("explorer", { layer, lat: location.lat, lng: location.lng, zoom: 12 })}
            className="inline-flex shrink-0 items-center gap-1 text-accent hover:underline"
          >
            Open in explorer <ExternalLink className="size-3" aria-hidden />
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
