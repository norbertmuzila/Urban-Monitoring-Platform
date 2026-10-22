"use client";

/**
 * Hands state from one page to the next without putting it in the URL, so every
 * address stays clean (/forests, /explorer). A link stores an intent just before
 * navigating; the target page reads it once on arrival.
 */

export type ExplorerIntent = { layer?: string; lat: number; lng: number; zoom: number };
type Intents = { forests: { iso2: string }; explorer: ExplorerIntent };

const key = (page: keyof Intents) => `ump:intent:${page}`;

export function setIntent<K extends keyof Intents>(page: K, value: Intents[K]) {
  try {
    sessionStorage.setItem(key(page), JSON.stringify(value));
  } catch {
    /* storage unavailable: the page opens with its defaults */
  }
}

/** Reads a pending intent without consuming it (safe in render initialisers). */
export function peekIntent<K extends keyof Intents>(page: K): Intents[K] | null {
  try {
    const raw = sessionStorage.getItem(key(page));
    return raw ? (JSON.parse(raw) as Intents[K]) : null;
  } catch {
    return null;
  }
}

/** Marks an intent as handled, and tidies the address bar. Call from an effect on arrival. */
export function consumeIntent(page: keyof Intents) {
  try {
    sessionStorage.removeItem(key(page));
  } catch {
    /* ignore */
  }
  cleanAddressBar();
}

/** Removes any query string from the address bar (old shared links keep working, then tidy up). */
export function cleanAddressBar() {
  if (window.location.search) window.history.replaceState(window.history.state, "", window.location.pathname);
}
