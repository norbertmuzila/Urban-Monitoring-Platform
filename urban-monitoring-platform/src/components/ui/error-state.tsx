"use client";

import { useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Shown while a live source is temporarily unavailable. With `onRetry` it also
 * retries by itself every 20 s, so the panel recovers without a click.
 */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const retry = useRef(onRetry);
  useEffect(() => {
    retry.current = onRetry;
  });
  const canRetry = onRetry != null;
  useEffect(() => {
    if (!canRetry) return;
    const id = setInterval(() => retry.current?.(), 20_000);
    return () => clearInterval(id);
  }, [canRetry]);

  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <RefreshCw className="size-5 text-subtle" aria-hidden />
      <p className="text-sm text-muted">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="rounded-md border border-line px-3 py-1 text-xs text-fg hover:bg-surface-2">
          Refresh now
        </button>
      )}
    </div>
  );
}
