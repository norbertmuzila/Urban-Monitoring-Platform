"use client";

import { useSearchParams } from "next/navigation";
import { useCountries } from "@/lib/client/api";
import { Skeleton } from "@/components/ui/skeleton";
import { ForestsView } from "./forests-view";

/** Reads /forests?country=BR in the browser; codes that are not a known country fall back to Brazil. */
export function ForestsEntry() {
  const code = useSearchParams().get("country")?.toUpperCase() ?? null;
  const { data, error } = useCountries();
  if (!data && !error) return <Skeleton className="h-[70dvh] w-full rounded-xl" />;
  const known = code != null && (data?.countries.some((c) => c.iso2 === code) ?? /^[A-Z]{2}$/.test(code));
  return <ForestsView initialIso2={known ? code! : "BR"} />;
}
