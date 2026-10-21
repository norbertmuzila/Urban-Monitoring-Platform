import "server-only";
import countriesData from "@/lib/data/geo/countries.json";
import citiesData from "@/lib/data/geo/cities.json";
import shapesData from "@/lib/data/geo/shapes.json";
import { inBBox, pointInGeometry, type BBox, type PolygonGeometry } from "@/lib/geo";

export interface StateInfo {
  code: string;
  name: string;
  cities: number;
}

export interface CountryInfo {
  iso2: string;
  iso3: string;
  name: string;
  capital: string | null;
  continent: string;
  population: number;
  areaKm2: number;
  center: [number, number] | null;
  bbox: BBox | null;
  cityCount: number;
  states: StateInfo[];
}

/** A populated place from GeoNames. */
export interface Place {
  id: number;
  name: string;
  stateCode: string;
  state: string;
  countryIso2: string;
  country: string;
  lat: number;
  lng: number;
  population: number;
}

type CityRow = [number, string, string, number, number, number];

export const COUNTRIES = countriesData.countries as unknown as CountryInfo[];
export const GEO_SOURCES = { countries: countriesData.source, cities: citiesData.source, shapes: shapesData.source };

const CITIES = citiesData.cities as unknown as Record<string, CityRow[]>;
const SHAPES = shapesData.shapes as unknown as Record<string, { bbox: BBox; geometry: PolygonGeometry }>;
const byIso2 = new Map(COUNTRIES.map((c) => [c.iso2, c]));

export const getCountry = (iso2: string) => byIso2.get(iso2.toUpperCase()) ?? null;
export const getCountryShape = (iso2: string) => SHAPES[iso2.toUpperCase()] ?? null;

function toPlace(country: CountryInfo, row: CityRow): Place {
  const [id, name, stateCode, lat, lng, population] = row;
  return {
    id,
    name,
    stateCode,
    state: country.states.find((s) => s.code === stateCode)?.name ?? "",
    countryIso2: country.iso2,
    country: country.name,
    lat,
    lng,
    population,
  };
}

/** Cities of a country (optionally one state), largest first. */
export function citiesOf(iso2: string, stateCode?: string, limit = 5000): Place[] {
  const country = getCountry(iso2);
  if (!country) return [];
  const rows = CITIES[country.iso2] ?? [];
  return rows
    .filter((r) => stateCode == null || r[2] === stateCode)
    .slice(0, limit)
    .map((r) => toPlace(country, r));
}

/** Looks up a GeoNames id (only places in the ≥1,000 population dataset). */
export function placeById(id: number): Place | null {
  for (const country of COUNTRIES) {
    const row = CITIES[country.iso2]?.find((r) => r[0] === id);
    if (row) return toPlace(country, row);
  }
  return null;
}

// 1° grid → polygon parts whose bounding box touches the cell. Matching ~100k fire
// detections drops from seconds to about one second compared with testing every country.
type Part = { iso2: string; bbox: BBox; geometry: PolygonGeometry };
let gridIndex: Map<number, Part[]> | null = null;

function buildGrid() {
  const grid = new Map<number, Part[]>();
  for (const [iso2, s] of Object.entries(SHAPES)) {
    const polys = s.geometry.type === "Polygon" ? [s.geometry.coordinates] : s.geometry.coordinates;
    for (const poly of polys) {
      const xs = poly[0].map((p) => p[0]);
      const ys = poly[0].map((p) => p[1]);
      const part: Part = { iso2, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], geometry: { type: "Polygon", coordinates: poly } };
      for (let gx = Math.floor(part.bbox[0]); gx <= Math.floor(part.bbox[2]); gx++)
        for (let gy = Math.floor(part.bbox[1]); gy <= Math.floor(part.bbox[3]); gy++) {
          const key = gx * 1000 + gy;
          const cell = grid.get(key);
          if (cell) cell.push(part);
          else grid.set(key, [part]);
        }
    }
  }
  return grid;
}

/** Country containing a point (Natural Earth outlines). */
export function countryAt(lng: number, lat: number): string | null {
  gridIndex ??= buildGrid();
  for (const part of gridIndex.get(Math.floor(lng) * 1000 + Math.floor(lat)) ?? []) {
    if (inBBox(lng, lat, part.bbox) && pointInGeometry(lng, lat, part.geometry)) return part.iso2;
  }
  return null;
}
