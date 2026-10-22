import { z } from "zod";
import { handle, json, parseQuery } from "@/lib/server/http";
import { geocode } from "@/lib/server/open-meteo";

const Query = z.object({
  q: z.string().trim().min(2, "Query must be at least 2 characters").max(80),
  count: z.coerce.number().int().min(1).max(20).default(8),
  country: z
    .string()
    .regex(/^[A-Za-z]{2}$/, "country must be an ISO 3166-1 alpha-2 code")
    .transform((c) => c.toUpperCase())
    .optional(),
});

/** GET /api/geocode?q=&country= — place search worldwide or within one country. */
export const GET = handle(async (request: Request) => {
  const { q, count, country } = parseQuery(request, Query);
  return json({ results: await geocode(q, count, country ?? null) }, { sMaxAge: 86400 });
});
