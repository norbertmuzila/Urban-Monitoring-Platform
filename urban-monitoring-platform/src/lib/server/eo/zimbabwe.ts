import "server-only";
import districtsData from "@/lib/data/zimbabwe/districts.json";
import sitesData from "@/lib/data/zimbabwe/mining-sites.json";
import { inBBox, pointInGeometry, unionBBox, type BBox, type PolygonGeometry } from "@/lib/geo";

export interface District {
  id: string;
  name: string;
  urban: boolean;
  areaKm2: number;
  bbox: BBox;
  centroid: [number, number];
  geometry: PolygonGeometry;
}

export interface MiningSite {
  id: string;
  name: string | null;
  kind: "quarry" | "mine" | "shaft" | "adit";
  resource: string | null;
  lat: number;
  lng: number;
  district: string;
}

export const DISTRICTS = districtsData.districts as unknown as District[];
export const DISTRICTS_META = { source: districtsData.source, license: districtsData.license, year: districtsData.year };
export const MINING_SITES = sitesData.sites as MiningSite[];
export const MINING_SITES_META = { source: sitesData.source, license: sitesData.license, snapshot: sitesData.snapshot };

export const ZIMBABWE_BBOX: BBox = unionBBox(DISTRICTS.map((d) => d.bbox));

const byId = new Map(DISTRICTS.map((d) => [d.id, d]));
export const getDistrict = (id: string) => byId.get(id) ?? null;

/** District containing a point (bbox pre-filter, then exact test). */
export function districtAt(lng: number, lat: number): District | null {
  if (!inBBox(lng, lat, ZIMBABWE_BBOX)) return null;
  for (const d of DISTRICTS) if (inBBox(lng, lat, d.bbox) && pointInGeometry(lng, lat, d.geometry)) return d;
  return null;
}

export const sitesInDistrict = (id: string) => MINING_SITES.filter((s) => s.district === id);
