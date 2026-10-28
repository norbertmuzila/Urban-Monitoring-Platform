import type { Metadata } from "next";
import { Suspense } from "react";
import { ForestsEntry } from "@/components/forests/forests-entry";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Forests & fires" };

/** Static shell; ?country= is read in the browser (ForestsEntry). */
export default function ForestsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[70dvh] w-full rounded-xl" />}>
      <ForestsEntry />
    </Suspense>
  );
}
