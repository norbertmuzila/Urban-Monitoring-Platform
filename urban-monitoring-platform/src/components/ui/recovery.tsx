"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { reportClientError } from "@/lib/client/report-error";

const KEY = "ump:recovery";
const WINDOW_MS = 60_000;

/** Counts failures of this page within the last minute (survives the reload step). */
function nextAttempt(): number {
  try {
    const raw = sessionStorage.getItem(KEY);
    const last = raw ? (JSON.parse(raw) as { path: string; at: number; n: number }) : null;
    const n = last && last.path === location.pathname && Date.now() - last.at < WINDOW_MS ? last.n + 1 : 1;
    sessionStorage.setItem(KEY, JSON.stringify({ path: location.pathname, at: Date.now(), n }));
    return n;
  } catch {
    return 3;
  }
}

/**
 * Fallback for route error boundaries. Recovery is escalated quietly:
 *   1st failure → re-render the view (fixes brief network drops while streaming);
 *   2nd failure → reload the page (fixes a tab left open across a deploy);
 *   after that  → a panel, which keeps retrying by itself every 15 s.
 * Every failure is reported to the server log for diagnosis.
 */
export function Recovery({ error, retry }: { error: unknown; retry: () => void }) {
  const [gaveUp, setGaveUp] = useState(false);
  // Latest retry function; the escalation below runs once per error, not on every re-render.
  const retryRef = useRef(retry);
  useEffect(() => {
    retryRef.current = retry;
  });

  useEffect(() => {
    console.error(error);
    reportClientError(error);
    const n = nextAttempt();
    if (n === 1) {
      const id = setTimeout(() => retryRef.current(), 400);
      return () => clearTimeout(id);
    }
    if (n === 2) {
      window.location.reload();
      return;
    }
    setGaveUp(true); // eslint-disable-line react-hooks/set-state-in-effect
    const id = setInterval(() => retryRef.current(), 15_000);
    return () => clearInterval(id);
  }, [error]);

  if (!gaveUp) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center gap-2 text-sm text-muted">
        <LoaderCircle className="size-4 animate-spin text-accent" aria-hidden /> Loading…
      </div>
    );
  }

  const ref = error instanceof Error ? (error as Error & { digest?: string }).digest ?? error.message : String(error);
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 text-center">
      <RefreshCw className="size-6 animate-spin text-subtle [animation-duration:3s]" aria-hidden />
      <p className="max-w-sm text-sm text-muted">Reconnecting to live data…</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-canvas hover:opacity-90">
          Reload
        </button>
        <Link href="/" className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-surface-2">
          Overview
        </Link>
      </div>
      <p className="max-w-sm truncate font-mono text-[10px] text-subtle" title={ref}>
        ref: {ref.slice(0, 80)}
      </p>
    </div>
  );
}
