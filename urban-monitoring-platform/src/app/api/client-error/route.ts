import { z } from "zod";
import { handle, json } from "@/lib/server/http";

const Report = z.object({
  message: z.string().max(500),
  stack: z.string().max(4000).optional(),
  digest: z.string().max(100).optional(),
  path: z.string().max(200),
  userAgent: z.string().max(400).optional(),
  language: z.string().max(40).optional(),
  translated: z.boolean().optional(),
});

/** POST /api/client-error — browser render failures, written to the server log for diagnosis. */
export const POST = handle(async (request: Request) => {
  const text = await request.text();
  if (text.length > 6000) return json({ ok: false }, "no-store", { status: 413 });
  const report = Report.parse(JSON.parse(text));
  console.error("[client-error]", JSON.stringify(report));
  return json({ ok: true }, "no-store");
});
