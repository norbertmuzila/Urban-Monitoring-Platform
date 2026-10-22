"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { fetcher } from "@/lib/client/api";
import type { Location } from "@/lib/data/types";
import type { Place } from "@/lib/server/geo";
import { MonitorView } from "./monitor-view";
import { MonitorSkeleton } from "./monitor-skeleton";

/**
 * The monitor opens on the selected city (kept in the browser). Old shared links —
 * ?place=<GeoNames id> and/or ?lat=&lng=&name=&country=&iso2=[&state=] — are still
 * honoured once; MonitorView then tidies the address back to /dashboard.
 */
export function MonitorEntry() {
  const sp = useSearchParams();
  const [q] = useState(() => new URLSearchParams(sp.toString()));
  const id = Number(q.get("place"));
  const lat = Number(q.get("lat"));
  const lng = Number(q.get("lng"));
  const name = q.get("name")?.slice(0, 80);
  const country = q.get("country")?.slice(0, 80);
  const iso2 = q.get("iso2")?.toUpperCase();
  const validId = Number.isInteger(id) && id > 0;

  const fromParams: Location | null =
    q.has("lat") && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && name && country && iso2 && /^[A-Z]{2}$/.test(iso2)
      ? { id: validId ? id : Math.round((lat + 90) * 1e6 + (lng + 180) * 1e2), name, state: q.get("state")?.slice(0, 80) ?? null, country, iso2, lat, lng, population: null }
      : null;

  // Bare ?place=<id> links are resolved through the API.
  const lookup = useSWR<Place>(!fromParams && validId ? `/api/geo/places/${id}` : null, fetcher, { revalidateOnFocus: false, shouldRetryOnError: false });
  if (lookup.isLoading) return <MonitorSkeleton />;

  const p = lookup.data;
  const initial: Location | null =
    fromParams ?? (p ? { id: p.id, name: p.name, state: p.state || null, country: p.country, iso2: p.countryIso2, lat: p.lat, lng: p.lng, population: p.population } : null);
  return <MonitorView initial={initial} />;
}
