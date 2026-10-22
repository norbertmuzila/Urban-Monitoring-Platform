"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocation } from "@/components/providers";
import { consumeIntent, peekIntent } from "@/lib/client/intent";
import { EO_LAYERS } from "@/lib/eo/layers";
import { ExplorerView } from "./explorer-view";

const num = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  return v != null && v !== "" && Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/**
 * Opens on a layer and place handed over by another page (or an old
 * ?layer=&lat=&lng=&z= link), else on the selected city. The address stays /explorer.
 */
export function ExplorerEntry() {
  const sp = useSearchParams();
  const { location } = useLocation();
  const [initial] = useState(() => {
    const intent = peekIntent("explorer");
    const requested = intent?.layer ?? sp.get("layer");
    return {
      layer: requested && EO_LAYERS.some((l) => l.id === requested) ? requested : "ndvi",
      lat: num(intent?.lat ?? sp.get("lat"), -85, 85) ?? location.lat,
      lng: num(intent?.lng ?? sp.get("lng"), -180, 180) ?? location.lng,
      zoom: num(intent?.zoom ?? sp.get("z"), 3, 18) ?? 12,
    };
  });
  useEffect(() => consumeIntent("explorer"), []);
  return <ExplorerView initial={initial} />;
}
