import "server-only";
import { z } from "zod";
import { EO_EARLIEST_DATE, EO_WINDOW_DAYS, todayUtc } from "./layers";

/** Shared validation for layer/window query parameters. */
export const LayerWindowQuery = z.object({
  layer: z.string().min(1).max(40),
  days: z.coerce
    .number()
    .int()
    .refine((d) => (EO_WINDOW_DAYS as readonly number[]).includes(d), { message: `days must be one of ${EO_WINDOW_DAYS.join(", ")}` })
    .default(60),
  end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "end must be YYYY-MM-DD")
    .refine((d) => d >= EO_EARLIEST_DATE, { message: `end must be on or after ${EO_EARLIEST_DATE}` })
    .optional()
    .transform((d) => {
      const today = todayUtc();
      return !d || d > today ? today : d;
    }),
});

export const BBoxParam = z
  .string()
  .transform((s) => s.split(",").map(Number))
  .refine((b) => b.length === 4 && b.every(Number.isFinite) && b[0] < b[2] && b[1] < b[3] && b[0] >= -180 && b[2] <= 180 && b[1] >= -90 && b[3] <= 90, {
    message: "bbox must be minLng,minLat,maxLng,maxLat",
  })
  .transform((b) => b as [number, number, number, number]);
