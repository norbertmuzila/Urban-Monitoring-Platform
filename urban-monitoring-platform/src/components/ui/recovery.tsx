"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";

const KEY = "ump:recovered";

/** True if this page already recovered by reloading in the last 30 s (stops reload loops). */
function recentlyReloaded() {
  try {
    const raw = sessionStorage.getItem(KEY);
    const last = raw ? (JSON.parse(raw) as { path: string; at: number }) : null;
    return last?.path === location.pathname && Date.now() - last.at < 30_000;
  } catch {
    return false;
  }
}

function markReload() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path: location.pathname, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

/**
 * Fallback for route error boundaries. A page that fails to render (most often an
 * open tab still running a previous release after a deploy) reloads itself once
 * with the current release; only if that does not help is a panel shown.
 */
export function Recovery({ error, retry }: { error: unknown; retry: () => void }) {
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    console.error(error);
    if (recentlyReloaded()) {
      setGaveUp(true); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    markReload();
    window.location.reload();
  }, [error]);

  if (!gaveUp) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center gap-2 text-sm text-muted">
        <LoaderCircle className="size-4 animate-spin text-accent" aria-hidden /> Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 text-center">
      <RefreshCw className="size-6 text-subtle" aria-hidden />
      <p className="max-w-sm text-sm text-muted">This view did not load completely. Please try again.</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => retry()} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-canvas hover:opacity-90">
          Try again
        </button>
        <Link href="/" className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-surface-2">
          Overview
        </Link>
      </div>
    </div>
  );
}
