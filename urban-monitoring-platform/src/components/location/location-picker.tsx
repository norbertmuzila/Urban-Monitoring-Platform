"use client";

import { useEffect, useMemo, useState } from "react";
import { useCities, useCountries, useCountry, useGeocode } from "@/lib/client/api";
import type { Location } from "@/lib/data/types";
import { cn } from "@/lib/cn";
import { Flag } from "@/components/ui/flag";
import { Combobox, type ComboItem } from "./combobox";

const nf = new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 });

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/**
 * Country → state/province → city picker covering every country (GeoNames).
 * Cities ≥1,000 people are listed per state; any smaller place can be found by
 * typing — those results come from the geocoder, restricted to the chosen country.
 */
export function LocationPicker({
  value,
  onSelect,
  layout = "row",
  className,
}: {
  value: Location;
  onSelect: (loc: Location) => void;
  layout?: "row" | "stack";
  className?: string;
}) {
  const [iso2, setIso2] = useState(value.iso2);
  const [state, setState] = useState<string | null>(null);
  const [cityQuery, setCityQuery] = useState("");
  const debounced = useDebounced(cityQuery, 300);

  // Follow external changes (e.g. a recent place picked elsewhere); keep the state filter
  // when the new place is in the same country.
  const [lastValueId, setLastValueId] = useState(value.id);
  if (value.id !== lastValueId) {
    setLastValueId(value.id);
    if (value.iso2 !== iso2) {
      setIso2(value.iso2);
      setState(null);
    }
  }

  const countries = useCountries();
  const country = useCountry(iso2);
  const cities = useCities(iso2, state);
  const geo = useGeocode(debounced, iso2);

  const countryItems: ComboItem[] = useMemo(
    () =>
      (countries.data?.countries ?? []).map((c) => ({
        value: c.iso2,
        label: c.name,
        hint: [c.capital, c.continent].filter(Boolean).join(" · "),
        meta: c.population ? nf.format(c.population) : undefined,
        icon: <Flag iso2={c.iso2.toLowerCase()} className="h-3.5 w-5" />,
      })),
    [countries.data],
  );

  const stateItems: ComboItem[] = useMemo(
    () => [
      { value: "*", label: "All states / provinces", hint: "Largest cities nationwide" },
      ...(country.data?.country.states ?? []).map((s) => ({ value: s.code, label: s.name, meta: `${s.cities} places` })),
    ],
    [country.data],
  );

  const cityItems: ComboItem[] = useMemo(
    () =>
      (cities.data?.cities ?? []).map((c) => ({
        value: String(c.id),
        label: c.name,
        hint: c.state || undefined,
        meta: nf.format(c.population),
      })),
    [cities.data],
  );

  const geoItems: ComboItem[] = useMemo(
    () =>
      (geo.data?.results ?? [])
        // Same GeoNames ids as the bundled list: skip places already listed.
        .filter((r) => r.iso2.toUpperCase() === iso2 && !cities.data?.cities.some((c) => c.id === r.id))
        .map((r) => ({ value: `g${r.id}`, label: r.name, hint: r.admin1 ?? undefined, meta: r.population ? nf.format(r.population) : "town" })),
    [geo.data, iso2, cities.data],
  );

  const countryName = countries.data?.countries.find((c) => c.iso2 === iso2)?.name ?? value.country;

  const pickCity = (val: string) => {
    if (val.startsWith("g")) {
      const r = geo.data?.results.find((x) => `g${x.id}` === val);
      if (r) onSelect({ id: r.id, name: r.name, state: r.admin1, country: r.country || countryName, iso2, lat: r.lat, lng: r.lng, population: r.population });
      return;
    }
    const c = cities.data?.cities.find((x) => String(x.id) === val);
    if (c) onSelect({ id: c.id, name: c.name, state: c.state || null, country: c.country, iso2: c.countryIso2, lat: c.lat, lng: c.lng, population: c.population });
  };

  return (
    <div className={cn("grid gap-3", layout === "row" ? "md:grid-cols-[1.2fr_1fr_1.2fr]" : "grid-cols-1", className)}>
      <Combobox
        label="Country"
        placeholder="Choose a country"
        items={countryItems}
        value={iso2}
        loading={countries.isLoading}
        onChange={(v) => {
          setIso2(v);
          setState(null);
        }}
      />
      <Combobox
        label="State / province"
        placeholder={country.data ? `All of ${country.data.country.name}` : "Loading…"}
        items={stateItems}
        value={state ?? "*"}
        loading={country.isLoading}
        disabled={!country.data}
        emptyText="This country has no listed subdivisions"
        onChange={(v) => setState(v === "*" ? null : v)}
      />
      <Combobox
        label="City or town"
        placeholder={value.iso2 === iso2 ? value.name : "Choose a city"}
        items={cityItems}
        value={value.iso2 === iso2 ? String(value.id) : null}
        loading={cities.isLoading || (debounced.length >= 2 && geo.isLoading)}
        disabled={!country.data}
        onQueryChange={setCityQuery}
        extra={geoItems}
        extraHeading={`Other places in ${countryName}`}
        emptyText="Type at least two letters to search every town and village"
        onChange={pickCity}
      />
    </div>
  );
}
