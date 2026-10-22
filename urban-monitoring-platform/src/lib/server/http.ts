import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

/** Error carrying an HTTP status, converted to a JSON response by `handle`. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

type CachePolicy = { sMaxAge: number; staleWhileRevalidate?: number } | "no-store";

/** Cache-Control for Vercel's CDN: `s-maxage` caches at the edge, browsers always revalidate. */
function cacheHeader(policy: CachePolicy) {
  if (policy === "no-store") return "no-store";
  const swr = policy.staleWhileRevalidate ?? policy.sMaxAge * 5;
  return `public, max-age=0, s-maxage=${policy.sMaxAge}, stale-while-revalidate=${swr}`;
}

export function json(data: unknown, cache: CachePolicy, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", cacheHeader(cache));
  return Response.json(data, { ...init, headers });
}

/** Wraps a route handler with uniform JSON error responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      unstable_rethrow(err); // let Next.js control-flow signals (prerender bailouts etc.) through
      if (err instanceof ApiError) {
        return json({ error: err.message, details: err.details }, "no-store", { status: err.status });
      }
      if (err instanceof z.ZodError) {
        return json({ error: "Invalid request", details: z.flattenError(err).fieldErrors }, "no-store", { status: 400 });
      }
      console.error("[api] unhandled error", err);
      return json({ error: "Internal server error" }, "no-store", { status: 500 });
    }
  };
}

/** Parses URL search params against a zod schema (throws ZodError → 400). */
export function parseQuery<T extends z.ZodType>(request: Request, schema: T): z.infer<T> {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  return schema.parse(params);
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * fetch with a timeout and one retry (after 600 ms) on network errors, timeouts, rate
 * limits and 5xx; throws ApiError(502) if both attempts fail. Callers cache results with
 * `"use cache"` + `cacheLife` (Cache Components).
 */
export async function upstream<T>(url: string, opts: { timeoutMs?: number; label: string }): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    let res: Response | null = null;
    let failure: string;
    try {
      res = await fetch(url, {
        signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
        headers: { Accept: "application/json" },
      });
      if (res.ok) return (await res.json()) as T;
      failure = `${opts.label} responded with ${res.status}`;
    } catch (err) {
      failure = `${opts.label} is unreachable (${String(err).slice(0, 120)})`;
    }
    if (attempt >= 2 || (res && !RETRYABLE.has(res.status))) throw new ApiError(502, failure);
    await new Promise((r) => setTimeout(r, 600));
  }
}

/** Re-raises errors from a cached scope as ApiError so routes answer 502, not 500. */
export function asUpstreamError(err: unknown, label: string): ApiError {
  return err instanceof ApiError ? err : new ApiError(502, `${label} request failed`, String(err));
}

export const coords = {
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
};
