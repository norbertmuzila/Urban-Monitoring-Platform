"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocation } from "@/components/providers";
import { useCountries } from "@/lib/client/api";
import { consumeIntent, peekIntent } from "@/lib/client/intent";
import { Skeleton } from "@/components/ui/skeleton";
import { ForestsView } from "./forests-view";

/**
 * Picks the opening country: a country handed over by another page, an old
 * ?country= link, or the country of the selected city. The address stays /forests.
 */
export function ForestsEntry() {
  const sp = useSearchParams();
  const { location } = useLocation();
  const [requested] = useState(() => (peekIntent("forests")?.iso2 ?? sp.get("country") ?? location.iso2)?.toUpperCase() ?? null);
  useEffect(() => consumeIntent("forests"), []);

  const { data, error } = useCountries();
  if (!data && !error) return <Skeleton className="h-[70dvh] w-full rounded-xl" />;
  const known = requested != null && (data?.countries.some((c) => c.iso2 === requested) ?? /^[A-Z]{2}$/.test(requested));
  return <ForestsView initialIso2={known ? requested! : "BR"} />;
}
