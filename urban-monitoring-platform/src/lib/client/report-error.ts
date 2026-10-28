"use client";

/** Sends a render failure to /api/client-error (server log) so it can be diagnosed. */
export function reportClientError(error: unknown) {
  try {
    const e = error instanceof Error ? error : new Error(String(error));
    const body = JSON.stringify({
      message: e.message.slice(0, 500),
      stack: e.stack?.slice(0, 4000),
      digest: (e as Error & { digest?: string }).digest?.slice(0, 100),
      path: location.pathname.slice(0, 200),
      userAgent: navigator.userAgent.slice(0, 400),
      language: navigator.language?.slice(0, 40),
      // Browser page translation (e.g. Chrome's) rewrites text nodes and is a common cause of React DOM errors.
      translated: document.documentElement.classList.contains("translated-ltr") || document.documentElement.classList.contains("translated-rtl"),
    });
    if (!navigator.sendBeacon?.("/api/client-error", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/client-error", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
    }
  } catch {
    /* reporting must never throw */
  }
}
