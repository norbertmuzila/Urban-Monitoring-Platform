// Builds the static Zimbabwe reference datasets used by the land & mining watch:
//   src/lib/data/zimbabwe/districts.json     ZIMSTAT ADM2 districts (geoBoundaries, CC BY 3.0 IGO)
//   src/lib/data/zimbabwe/mining-sites.json  Mapped quarries / mines / shafts (OpenStreetMap, ODbL)
//
// Run occasionally to refresh:  node scripts/build-zimbabwe-data.mjs

import fs from "node:fs";
import path from "node:path";

const OUT = path.join(import.meta.dirname, "..", "src", "lib", "data", "zimbabwe");
const UA = "UrbanMonitoringPlatform/2.0 (research; github.com/norbertmuzila)";
const BOUNDARIES_API = "https://www.geoboundaries.org/api/current/gbOpen/ZWE/ADM2/";
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const OVERPASS_QUERY = `[out:json][timeout:170][bbox:-22.45,25.2,-15.6,33.1];
(nwr["landuse"="quarry"];nwr["man_made"="mineshaft"];nwr["industrial"="mine"];nwr["man_made"="adit"];);
out center tags;`;

const round = (n) => Math.round(n * 1e4) / 1e4; // ~11 m precision

/** Drops consecutive duplicate vertices left after rounding. */
function cleanRing(ring) {
  const out = [];
  for (const [x, y] of ring) {
    const p = [round(x), round(y)];
    const last = out.at(-1);
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out;
}

const polygons = (g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inGeometry = (x, y, g) => polygons(g).some((poly) => inRing(x, y, poly[0]) && !poly.slice(1).some((h) => inRing(x, y, h)));

/** Planar ring area in km² using a local equirectangular projection. */
function ringAreaKm2(ring) {
  const lat0 = (ring.reduce((s, p) => s + p[1], 0) / ring.length) * (Math.PI / 180);
  const kx = 111.32 * Math.cos(lat0);
  const ky = 110.57;
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] * kx + ring[i][0] * kx) * (ring[j][1] * ky - ring[i][1] * ky);
  return Math.abs(a / 2);
}

async function fetchJson(url, init) {
  const res = await fetch(url, { ...init, headers: { "User-Agent": UA, ...(init?.headers ?? {}) } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------- districts
const meta = await fetchJson(BOUNDARIES_API);
const raw = await fetchJson(meta.simplifiedGeometryGeoJSON);

const districts = raw.features
  .map((f) => {
    const geometry = { type: f.geometry.type, coordinates: polygons(f.geometry).map((p) => p.map(cleanRing)) };
    if (geometry.type === "Polygon") geometry.coordinates = geometry.coordinates[0];
    const outer = polygons(geometry).map((p) => p[0]);
    const xs = outer.flat().map((p) => p[0]);
    const ys = outer.flat().map((p) => p[1]);
    const largest = outer.reduce((a, b) => (ringAreaKm2(b) > ringAreaKm2(a) ? b : a));
    const name = f.properties.shapeName.trim();
    return {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      name,
      urban: /urban|town|^bulawayo$|^harare$|^chitungwiza$|^epworth$/i.test(name),
      areaKm2: Math.round(polygons(geometry).reduce((s, p) => s + ringAreaKm2(p[0]) - p.slice(1).reduce((h, r) => h + ringAreaKm2(r), 0), 0)),
      bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(round),
      centroid: [round(largest.reduce((s, p) => s + p[0], 0) / largest.length), round(largest.reduce((s, p) => s + p[1], 0) / largest.length)],
      geometry,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const ids = new Set();
for (const d of districts) {
  if (ids.has(d.id)) throw new Error(`duplicate district id ${d.id}`);
  ids.add(d.id);
}

// ------------------------------------------------------------- mining sites
let osm;
for (const url of OVERPASS) {
  try {
    osm = await fetchJson(url, { method: "POST", body: new URLSearchParams({ data: OVERPASS_QUERY }) });
    break;
  } catch (err) {
    console.warn("overpass failed:", String(err));
  }
}
if (!osm) throw new Error("All Overpass endpoints failed — retry later");

const KIND = (t) => (t.man_made === "mineshaft" ? "shaft" : t.man_made === "adit" ? "adit" : t.industrial === "mine" ? "mine" : "quarry");
const sites = [];
for (const e of osm.elements) {
  const lat = e.lat ?? e.center?.lat;
  const lng = e.lon ?? e.center?.lon;
  if (lat == null || lng == null) continue;
  const district = districts.find((d) => inGeometry(lng, lat, d.geometry));
  if (!district) continue; // outside Zimbabwe
  sites.push({
    id: `${e.type}/${e.id}`,
    name: e.tags.name ?? null,
    kind: KIND(e.tags),
    resource: e.tags.resource ?? e.tags["mine:resource"] ?? null,
    lat: round(lat),
    lng: round(lng),
    district: district.id,
  });
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(
  path.join(OUT, "districts.json"),
  JSON.stringify({
    source: `geoBoundaries gbOpen ZWE ADM2 (${meta.boundarySource})`,
    license: meta.boundaryLicense,
    year: meta.boundaryYearRepresented,
    districts,
  }),
);
fs.writeFileSync(
  path.join(OUT, "mining-sites.json"),
  JSON.stringify({ source: "OpenStreetMap contributors (Overpass API)", license: "ODbL 1.0", snapshot: osm.osm3s?.timestamp_osm_base ?? new Date().toISOString(), sites }),
);
console.log(`districts: ${districts.length}, mining sites: ${sites.length} (of ${osm.elements.length} in bbox)`);
