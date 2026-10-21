"use client";

import { useSearchParams } from "next/navigation";
import { EO_LAYERS } from "@/lib/eo/layers";
import { ExplorerView } from "./explorer-view";

const num = (v: string | null, min: number, max: number) => {
  const n = Number(v);
  return v != null && Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/** Reads deep links in the browser: /explorer?layer=bsi&lat=-18.93&lng=29.82&z=11 */
export function ExplorerEntry() {
  const sp = useSearchParams();
  const requested = sp.get("layer");
  const layer = requested && EO_LAYERS.some((l) => l.id === requested) ? requested : "ndvi";
  return (
    <ExplorerView
      initial={{
        layer,
        lat: num(sp.get("lat"), -85, 85) ?? -17.8292,
        lng: num(sp.get("lng"), -180, 180) ?? 31.0522,
        zoom: num(sp.get("z"), 3, 18) ?? 12,
      }}
    />
  );
}
