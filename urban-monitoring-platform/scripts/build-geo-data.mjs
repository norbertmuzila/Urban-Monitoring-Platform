// Builds the worldwide location reference data:
//   src/lib/data/geo/countries.json  every country/territory with states (admin-1) — GeoNames (CC BY 4.0)
//   src/lib/data/geo/cities.json     all populated places ≥ 1,000 people, grouped by country — GeoNames (CC BY 4.0)
//   src/lib/data/geo/shapes.json     country outlines, simplified — Natural Earth 1:50m (public domain)
//
// Refresh with:  npm run data:geo

import fs from "node:fs";
import path from "node:path";
import { unzipSync, strFromU8 } from "fflate";

const OUT = path.join(import.meta.dirname, "..", "src", "lib", "data", "geo");
const GEONAMES = "https://download.geonames.org/export/dump";
const NATURAL_EARTH = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";

async function download(url) {
  const res = await fetch(url, { headers: { "User-Agent": "UrbanMonitoringPlatform/2.0 (data build)" } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}
const text = async (url) => strFromU8(await download(url));
const rows = (tsv) => tsv.split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
const r4 = (n) => Math.round(n * 1e4) / 1e4;
const r3 = (n) => Math.round(n * 1e3) / 1e3;

// ---------------------------------------------------------------- GeoNames
const [countryInfo, admin1, citiesZip] = await Promise.all([
  text(`${GEONAMES}/countryInfo.txt`),
  text(`${GEONAMES}/admin1CodesASCII.txt`),
  download(`${GEONAMES}/cities1000.zip`),
]);

const admin1Names = new Map(rows(admin1).map(([key, name]) => [key, name]));
const citiesTsv = strFromU8(unzipSync(citiesZip)["cities1000.txt"]);

/** iso2 → [[geonameid, name, admin1, lat, lng, population], …] sorted by population. */
const cities = {};
const capitals = {};
for (const c of rows(citiesTsv)) {
  const [id, name, , , lat, lng, , featureCode, cc, , rawAdmin1, , , , pop] = c;
  // Retired or unnamed GeoNames region codes are grouped as "Other areas" ("_").
  const admin1Code = admin1Names.has(`${cc}.${rawAdmin1}`) ? rawAdmin1 : "_";
  (cities[cc] ??= []).push([Number(id), name, admin1Code, r4(Number(lat)), r4(Number(lng)), Number(pop)]);
  if (featureCode === "PPLC") capitals[cc] = [Number(lat), Number(lng)];
}
for (const list of Object.values(cities)) list.sort((a, b) => b[5] - a[5]);

// Dissolved states and uninhabited territories are excluded.
const OBSOLETE = new Set(["AN", "CS"]);

const countries = rows(countryInfo)
  .filter(([iso2, , , , , , , population]) => !OBSOLETE.has(iso2) && (Number(population) > 0 || cities[iso2]?.length))
  .map((c) => {
  const [iso2, iso3, , , name, capital, area, population, continent] = c;
  const list = cities[iso2] ?? [];
  const states = new Map();
  for (const city of list) {
    const code = city[2];
    if (!states.has(code)) states.set(code, { code, name: code === "_" ? "Other areas" : admin1Names.get(`${iso2}.${code}`), cities: 0 });
    states.get(code).cities++;
  }
  const lats = list.map((x) => x[3]);
  const lngs = list.map((x) => x[4]);
  const anchor = capitals[iso2] ?? (list[0] ? [list[0][3], list[0][4]] : null);
  return {
    iso2,
    iso3,
    name,
    capital: capital || null,
    continent,
    population: Number(population) || 0,
    areaKm2: Number(area) || 0,
    center: anchor ? [r4(anchor[0]), r4(anchor[1])] : null,
    bbox: list.length ? [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)] : null,
    cityCount: list.length,
    // Named states alphabetically, "Other areas" last.
    states: [...states.values()].sort((a, b) => (a.code === "_") - (b.code === "_") || a.name.localeCompare(b.name)),
  };
});
countries.sort((a, b) => a.name.localeCompare(b.name));

// ------------------------------------------------------------ Natural Earth
const ne = JSON.parse(await text(NATURAL_EARTH));
const shapes = {};
for (const f of ne.features) {
  const iso2 = f.properties.ISO_A2_EH !== "-99" ? f.properties.ISO_A2_EH : f.properties.ISO_A2;
  if (!iso2 || iso2 === "-99") continue;
  const ring = (r) => {
    const out = [];
    for (const [x, y] of r) {
      const p = [r3(x), r3(y)];
      const last = out.at(-1);
      if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
    }
    return out.length >= 4 ? out : null;
  };
  const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates)
    .map((p) => p.map(ring).filter(Boolean))
    .filter((p) => p.length);
  const xs = polys.flatMap((p) => p[0].map((q) => q[0]));
  const ys = polys.flatMap((p) => p[0].map((q) => q[1]));
  shapes[iso2] = { bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], geometry: { type: "MultiPolygon", coordinates: polys } };
}

fs.mkdirSync(OUT, { recursive: true });
const stamp = new Date().toISOString();
fs.writeFileSync(path.join(OUT, "countries.json"), JSON.stringify({ source: "GeoNames countryInfo + admin1 (CC BY 4.0)", built: stamp, countries }));
fs.writeFileSync(path.join(OUT, "cities.json"), JSON.stringify({ source: "GeoNames cities1000 (CC BY 4.0)", built: stamp, cities }));
fs.writeFileSync(path.join(OUT, "shapes.json"), JSON.stringify({ source: "Natural Earth 1:50m admin-0 (public domain)", built: stamp, shapes }));

const totalCities = Object.values(cities).reduce((s, l) => s + l.length, 0);
const totalStates = countries.reduce((s, c) => s + c.states.length, 0);
console.log(`countries: ${countries.length}, states: ${totalStates}, cities: ${totalCities}, shapes: ${Object.keys(shapes).length}`);
