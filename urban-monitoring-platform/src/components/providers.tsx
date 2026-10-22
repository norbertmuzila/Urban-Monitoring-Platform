"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import { SWRConfig } from "swr";
import type { Location } from "@/lib/data/types";

// ------------------------------------------------------------------------
// Selected location — persisted in localStorage, synced across tabs.
// ------------------------------------------------------------------------

const STORAGE_KEY = "ump:location:v2";
const CHANGE_EVENT = "ump:location-change";
const MAX_RECENT = 8;

/** Default until the viewer picks a place: Harare, Zimbabwe (GeoNames 890299). */
export const DEFAULT_LOCATION: Location = {
  id: 890299,
  name: "Harare",
  state: "Harare",
  country: "Zimbabwe",
  iso2: "ZW",
  lat: -17.8277,
  lng: 31.0534,
  population: 1542813,
};

type Selection = { current: Location; recent: Location[] };
const DEFAULT_SELECTION: Selection = { current: DEFAULT_LOCATION, recent: [DEFAULT_LOCATION] };

let cachedRaw: string | null = null;
let cachedValue: Selection = DEFAULT_SELECTION;

const isLocation = (l: unknown): l is Location =>
  !!l && typeof l === "object" && typeof (l as Location).lat === "number" && typeof (l as Location).lng === "number" && typeof (l as Location).name === "string";

function getSnapshot(): Selection {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return cachedValue;
  }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    cachedValue = isLocation(parsed?.current) && Array.isArray(parsed?.recent) ? { current: parsed.current, recent: parsed.recent.filter(isLocation) } : DEFAULT_SELECTION;
  } catch {
    cachedValue = DEFAULT_SELECTION;
  }
  return cachedValue;
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && onChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function write(next: Selection) {
  const raw = JSON.stringify(next);
  try {
    localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Storage unavailable (private mode): keep in memory only.
    cachedRaw = raw;
    cachedValue = next;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

const sameLocation = (a: Location, b: Location) => a.id === b.id || (Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lng - b.lng) < 1e-4);

export function selectLocation(loc: Location) {
  const s = getSnapshot();
  write({ current: loc, recent: [loc, ...s.recent.filter((r) => !sameLocation(r, loc))].slice(0, MAX_RECENT) });
}

export function forgetLocation(loc: Location) {
  const s = getSnapshot();
  const recent = s.recent.filter((r) => !sameLocation(r, loc));
  write({ current: s.current, recent: recent.length ? recent : [s.current] });
}

// ------------------------------------------------------------------------

interface LocationState {
  location: Location;
  recent: Location[];
  select: (loc: Location) => void;
  forget: (loc: Location) => void;
}

const LocationContext = createContext<LocationState | null>(null);

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used inside <Providers>");
  return ctx;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Server render (and hydration) use the default; the stored selection applies right after.
  const selection = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_SELECTION);
  // Providers sits at the layout root, so it re-renders (and this object changes) only when the selection does.
  const value: LocationState = { location: selection.current, recent: selection.recent, select: selectLocation, forget: forgetLocation };
  return (
    <SWRConfig value={{ errorRetryCount: 3, dedupingInterval: 4000 }}>
      <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
    </SWRConfig>
  );
}
