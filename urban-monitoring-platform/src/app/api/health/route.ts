import { connection } from "next/server";
import { handle, json } from "@/lib/server/http";
import { checkHealth } from "@/lib/server/health";

/** GET /api/health — upstream data-provider availability and latency. */
export const GET = handle(async () => {
  await connection(); // live probes: always run at request time
  const report = await checkHealth();
  return json(report, { sMaxAge: 30, staleWhileRevalidate: 60 }, { status: report.status === "down" ? 503 : 200 });
});
