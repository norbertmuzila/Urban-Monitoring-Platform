import type { Metadata } from "next";
import { Suspense } from "react";
import { ExplorerEntry } from "@/components/eo/explorer-entry";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Satellite explorer" };

/** Static shell; deep-link parameters are read in the browser (ExplorerEntry). */
export default function ExplorerPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[70dvh] w-full rounded-xl" />}>
      <ExplorerEntry />
    </Suspense>
  );
}
