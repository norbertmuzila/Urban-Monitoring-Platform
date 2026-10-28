import type { Metadata } from "next";
import { Suspense } from "react";
import { MonitorEntry } from "@/components/monitor/monitor-entry";
import { MonitorSkeleton } from "@/components/monitor/monitor-skeleton";

export const metadata: Metadata = { title: "City monitor" };

/** Static shell; the shared-link query is read in the browser (MonitorEntry). */
export default function DashboardPage() {
  return (
    <Suspense fallback={<MonitorSkeleton />}>
      <MonitorEntry />
    </Suspense>
  );
}
