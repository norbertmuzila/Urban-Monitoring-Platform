// Catalogue of live Earth-observation layers. Shared by the API (tile/scene endpoints)
// and the UI (layer picker, legends, methodology). Every layer here renders from
// open, key-free sources: Microsoft Planetary Computer (Copernicus/USGS/JAXA/ESA
// collections) and NASA GIBS.

export type EoGroup = "Optical" | "Radar" | "Thermal" | "Terrain & land cover" | "Night-time";

export type EoLegend =
  | { type: "gradient"; stops: string[]; labels: string[]; unit?: string }
  | { type: "classes"; items: { color: string; label: string }[] };

export interface EoLayer {
  id: string;
  label: string;
  group: EoGroup;
  sensor: string;
  resolution: string;
  revisit: string;
  /** What the layer reveals — shown in the methodology panel. */
  detects: string;
  formula?: string;
  source: { kind: "planetary-computer"; collection: string } | { kind: "gibs"; layer: string; maxZoom: number };
  /** "recent" layers mosaic the clearest scenes inside a time window; "static" products have a fixed vintage. */
  temporal: "recent" | "static";
  /** Max scene cloud cover for optical layers (percent). */
  maxCloud?: number;
  /** Extra STAC filter args (cql2-json) — e.g. restrict Landsat to 8/9. */
  filter?: object[];
  /** Titiler render parameters (repeated keys as arrays). */
  render?: Record<string, string | string[]>;
  legend?: EoLegend;
  attribution: string;
  /** Planetary Computer only renders dynamic mosaics from this zoom upward (204 below). */
  minZoom?: number;
}

const COP = "Contains modified Copernicus Sentinel data, processed by Microsoft Planetary Computer";

/**
 * Stepped colour map for expression layers. Titiler rejects `nodata` with expressions, so
 * values at/below `min` (masked pixels pushed far below range) rescale to byte 0, which is
 * transparent here. Returns the render params and a matching legend.
 */
function steppedColormap(min: number, max: number, classes: { upTo: number; color: string; label: string }[]) {
  const toByte = (v: number) => Math.max(1, Math.min(256, Math.round(((v - min) / (max - min)) * 255)));
  const rgba = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(255);
  const intervals: [number[], number[]][] = [[[0, 1], [0, 0, 0, 0]]];
  let lower = 1;
  for (const c of classes) {
    const upper = c.upTo >= max ? 256 : toByte(c.upTo);
    intervals.push([[lower, upper], rgba(c.color)]);
    lower = upper;
  }
  return {
    render: { rescale: `${min},${max}`, colormap: JSON.stringify(intervals) },
    legend: { type: "classes" as const, items: classes.map((c) => ({ color: c.color, label: c.label })) },
  };
}

const NDTI_STEPS = steppedColormap(-0.25, 0.25, [
  { upTo: -0.1, color: "#bfe6f5", label: "Clear (< −0.10)" },
  { upTo: 0, color: "#fff7bc", label: "Low (−0.10–0)" },
  { upTo: 0.1, color: "#fec44f", label: "Moderate (0–0.10)" },
  { upTo: 0.2, color: "#ec7014", label: "High (0.10–0.20)" },
  { upTo: 0.25, color: "#993404", label: "Very turbid (> 0.20)" },
]);

const LST_STEPS = steppedColormap(-10, 60, [
  { upTo: 15, color: "#1b0c41", label: "< 15 °C" },
  { upTo: 20, color: "#4a0c6b", label: "15–20 °C" },
  { upTo: 25, color: "#781c6d", label: "20–25 °C" },
  { upTo: 30, color: "#a52c60", label: "25–30 °C" },
  { upTo: 35, color: "#cf4446", label: "30–35 °C" },
  { upTo: 40, color: "#ed6925", label: "35–40 °C" },
  { upTo: 45, color: "#fb9b06", label: "40–45 °C" },
  { upTo: 60, color: "#fcffa4", label: "> 45 °C" },
]);

const S2 = { sensor: "Copernicus Sentinel-2A/B/C MSI", resolution: "10–20 m", revisit: "≤5 days (3 satellites)", minZoom: 9 } as const;
const S2_SOURCE = { kind: "planetary-computer", collection: "sentinel-2-l2a" } as const;

/** Sentinel-2 band-math expressions (L2A surface reflectance). */
export const S2_INDEX = {
  ndvi: "(B08-B04)/(B08+B04)",
  ndmi: "(B8A-B11)/(B8A+B11)",
  bsi: "((B11+B04)-(B08+B02))/((B11+B04)+(B08+B02))",
  ndbi: "(B11-B08)/(B11+B08)",
  // Turbidity only over water pixels (NDWI > 0); land is pushed to the nodata value.
  ndti: "where((B03-B08)/(B03+B08)>0,(B04-B03)/(B04+B03),-9)",
} as const;

export const EO_LAYERS: EoLayer[] = [
  // ----------------------------------------------------------------- optical
  {
    id: "truecolor",
    label: "True colour",
    group: "Optical",
    ...S2,
    detects: "Natural-colour view for visual verification of clearings, pits, tailings and urban expansion.",
    source: S2_SOURCE,
    temporal: "recent",
    maxCloud: 15,
    render: { assets: "visual", asset_bidx: "visual|1,2,3", nodata: "0" },
    attribution: COP,
  },
  {
    id: "falsecolor",
    label: "False colour (vegetation)",
    group: "Optical",
    ...S2,
    detects: "NIR-red-green composite: healthy vegetation appears bright red, bare soil and excavation cyan-grey.",
    formula: "R = B08 (NIR) · G = B04 · B = B03",
    source: S2_SOURCE,
    temporal: "recent",
    maxCloud: 15,
    render: { assets: ["B08", "B04", "B03"], rescale: ["0,4500", "0,3000", "0,3000"], nodata: "0" },
    attribution: COP,
  },
  {
    id: "ndvi",
    label: "NDVI · vegetation",
    group: "Optical",
    ...S2,
    detects: "Vegetation vigour and canopy loss. Drops between dates reveal clearing, fire scars and mining strips.",
    formula: "(B08 − B04) / (B08 + B04)",
    source: S2_SOURCE,
    temporal: "recent",
    maxCloud: 15,
    render: { expression: S2_INDEX.ndvi, asset_as_band: "true", rescale: "-0.2,0.9", colormap_name: "rdylgn" },
    legend: { type: "gradient", stops: ["#a50026", "#f46d43", "#fee08b", "#d9ef8b", "#66bd63", "#006837"], labels: ["−0.2 bare", "0.3", "0.9 dense"] },
    attribution: COP,
  },
  {
    id: "ndmi",
    label: "NDMI · canopy moisture",
    group: "Optical",
    ...S2,
    detects: "Leaf-water content. Moisture decline is an early sign of canopy stress before trees are felled.",
    formula: "(B8A − B11) / (B8A + B11)",
    source: S2_SOURCE,
    temporal: "recent",
    maxCloud: 15,
    render: { expression: S2_INDEX.ndmi, asset_as_band: "true", rescale: "-0.4,0.5", colormap_name: "brbg" },
    legend: { type: "gradient", stops: ["#543005", "#bf812d", "#f6e8c3", "#80cdc1", "#01665e"], labels: ["dry −0.4", "0", "moist 0.5"] },
    attribution: COP,
  },
  {
    id: "bsi",
    label: "BSI · bare soil & excavation",
    group: "Optical",
    ...S2,
    detects: "Exposed soil, stripped topsoil, pits and tailings. Rising BSI against last year flags new ground disturbance.",
    formula: "((B11 + B04) − (B08 + B02)) / ((B11 + B04) + (B08 + B02))",
    source: S2_SOURCE,
    temporal: "recent",
    maxCloud: 15,
    render: { expression: S2_INDEX.bsi, asset_as_band: "true", rescale: "-0.3,0.35", colormap_name: "ylorbr" },
    legend: { type: "gradient", stops: ["#ffffe5", "#fee391", "#fe9929", "#cc4c02", "#662506"], labels: ["vegetated", "mixed", "bare / excavated"] },
    attribution: COP,
  },
  {
    id: "ndbi",
    label: "NDBI · built-up",
    group: "Optical",
    ...S2,
    detects: "Impervious surfaces (roofs, roads). Tracks urban sprawl and informal settlement growth.",
    formula: "(B11 − B08) / (B11 + B08)",
    source: S2_SOURCE,
    temporal: "recent",
    maxCloud: 15,
    render: { expression: S2_INDEX.ndbi, asset_as_band: "true", rescale: "-0.4,0.3", colormap_name: "magma" },
    legend: { type: "gradient", stops: ["#000004", "#51127c", "#b73779", "#fc8961", "#fcfdbf"], labels: ["natural", "mixed", "built-up"] },
    attribution: COP,
  },
  {
    id: "ndti",
    label: "NDTI · river turbidity",
    group: "Optical",
    ...S2,
    detects: "Sediment plumes in rivers and dams — e.g. siltation from alluvial gold panning (Mazowe, Odzi, Munyati).",
    formula: "(B04 − B03) / (B04 + B03), water pixels only (NDWI > 0)",
    source: S2_SOURCE,
    temporal: "recent",
    maxCloud: 15,
    render: { expression: S2_INDEX.ndti, asset_as_band: "true", ...NDTI_STEPS.render },
    legend: NDTI_STEPS.legend,
    attribution: COP,
  },
  // ------------------------------------------------------------------- radar
  {
    id: "s1-composite",
    label: "SAR composite (VV/VH)",
    group: "Radar",
    sensor: "Copernicus Sentinel-1 C-SAR (RTC)",
    resolution: "10 m",
    revisit: "6–12 days, day & night",
    detects: "Cloud-penetrating radar: surface roughness, structures and soil turnover — usable through the rainy season.",
    formula: "R = VV · G = VH · B = VV/VH",
    source: { kind: "planetary-computer", collection: "sentinel-1-rtc" },
    minZoom: 8,
    temporal: "recent",
    render: { expression: "vv;vh;vv/vh", asset_as_band: "true", rescale: ["0,0.5", "0,0.05", "0,15"] },
    attribution: COP,
  },
  {
    id: "s1-vh",
    label: "SAR VH backscatter (dB)",
    group: "Radar",
    sensor: "Copernicus Sentinel-1 C-SAR (RTC)",
    resolution: "10 m",
    revisit: "6–12 days, day & night",
    detects: "Cross-polarised volume scattering: high under woody canopy, falling sharply after clearing or excavation.",
    formula: "10 · log10(VH)",
    source: { kind: "planetary-computer", collection: "sentinel-1-rtc" },
    minZoom: 8,
    temporal: "recent",
    render: { expression: "10*log10(vh)", asset_as_band: "true", rescale: "-25,-8", colormap_name: "viridis" },
    legend: { type: "gradient", stops: ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"], labels: ["−25 dB open", "−16", "−8 dB canopy"] },
    attribution: COP,
  },
  {
    id: "palsar",
    label: "L-band SAR (ALOS-2 PALSAR-2)",
    group: "Radar",
    sensor: "JAXA ALOS-2 PALSAR-2 annual mosaic",
    resolution: "25 m",
    revisit: "Annual",
    detects: "L-band penetrates woodland canopy: woody biomass and structural degradation (Great Dyke, greenstone belts).",
    formula: "HV backscatter (DN)",
    source: { kind: "planetary-computer", collection: "alos-palsar-mosaic" },
    minZoom: 8,
    temporal: "static",
    render: { assets: "HV", rescale: "0,8000", colormap_name: "greys_r" },
    legend: { type: "gradient", stops: ["#ffffff", "#969696", "#000000"], labels: ["low biomass", "", "high biomass"] },
    attribution: "© JAXA, processed by Microsoft Planetary Computer",
  },
  // ----------------------------------------------------------------- thermal
  {
    id: "lst",
    label: "Land surface temperature",
    group: "Thermal",
    sensor: "USGS Landsat 8/9 TIRS (Collection 2 L2)",
    resolution: "30 m (100 m native)",
    revisit: "8 days combined",
    detects: "Urban heat islands and thermal anomalies such as kilns, smelters and freshly cleared ground.",
    formula: "ST_B10 × 0.00341802 + 149.0 − 273.15 (°C)",
    source: { kind: "planetary-computer", collection: "landsat-c2-l2" },
    minZoom: 9,
    temporal: "recent",
    maxCloud: 15,
    filter: [{ op: "in", args: [{ property: "platform" }, ["landsat-8", "landsat-9"]] }],
    // Fill pixels (lwir11 = 0) evaluate to −124 °C and fall into the transparent class.
    render: { expression: "lwir11*0.00341802+149.0-273.15", asset_as_band: "true", ...LST_STEPS.render },
    legend: LST_STEPS.legend,
    attribution: "Landsat imagery courtesy of USGS, processed by Microsoft Planetary Computer",
  },
  // ----------------------------------------------------- terrain & land cover
  {
    id: "hillshade",
    label: "Terrain hillshade",
    group: "Terrain & land cover",
    sensor: "JAXA ALOS World 3D (AW3D30)",
    resolution: "30 m",
    revisit: "Static (2006–2011)",
    detects: "Relief for separating open-cast pits and spoil heaps from natural slopes and landslide scars.",
    source: { kind: "planetary-computer", collection: "alos-dem" },
    minZoom: 8,
    temporal: "static",
    render: { assets: "data", algorithm: "hillshade", buffer: "3" },
    attribution: "ALOS World 3D-30m © JAXA, processed by Microsoft Planetary Computer",
  },
  {
    id: "elevation",
    label: "Elevation",
    group: "Terrain & land cover",
    sensor: "JAXA ALOS World 3D (AW3D30)",
    resolution: "30 m",
    revisit: "Static (2006–2011)",
    detects: "Height above sea level; drives slope and wetness context for the screening model.",
    source: { kind: "planetary-computer", collection: "alos-dem" },
    minZoom: 8,
    temporal: "static",
    render: { assets: "data", rescale: "200,2200", colormap_name: "terrain" },
    legend: { type: "gradient", stops: ["#333399", "#00b2b2", "#99e599", "#e5d899", "#997f66", "#ffffff"], labels: ["200 m", "1200 m", "2200 m"] },
    attribution: "ALOS World 3D-30m © JAXA, processed by Microsoft Planetary Computer",
  },
  {
    id: "landcover",
    label: "Land cover (ESA WorldCover)",
    group: "Terrain & land cover",
    sensor: "ESA WorldCover (Sentinel-1/2)",
    resolution: "10 m",
    revisit: "2021 product",
    detects: "Reference land-cover classes: tree cover, cropland, built-up, bare and water.",
    source: { kind: "planetary-computer", collection: "esa-worldcover" },
    minZoom: 6,
    temporal: "static",
    render: { assets: "map", colormap_name: "esa-worldcover" },
    legend: {
      type: "classes",
      items: [
        { color: "#006400", label: "Tree cover" },
        { color: "#ffbb22", label: "Shrubland" },
        { color: "#ffff4c", label: "Grassland" },
        { color: "#f096ff", label: "Cropland" },
        { color: "#fa0000", label: "Built-up" },
        { color: "#b4b4b4", label: "Bare / sparse" },
        { color: "#0064c8", label: "Water" },
        { color: "#0096a0", label: "Wetland" },
      ],
    },
    attribution: "© ESA WorldCover project 2021, processed by Microsoft Planetary Computer",
  },
  // --------------------------------------------------------------- night-time
  {
    id: "nightlights",
    label: "Night-time lights (daily)",
    group: "Night-time",
    sensor: "Suomi-NPP VIIRS Day/Night Band",
    resolution: "750 m",
    revisit: "Nightly (cloud-affected)",
    detects: "Electrification and settlement growth; isolated lights in remote areas can indicate night-time camps.",
    source: { kind: "gibs", layer: "VIIRS_SNPP_DayNightBand_At_Sensor_Radiance", maxZoom: 8 },
    temporal: "recent",
    attribution: "NASA EOSDIS GIBS / LANCE",
  },
];

export const EO_GROUPS: EoGroup[] = ["Optical", "Radar", "Thermal", "Terrain & land cover", "Night-time"];

export const getEoLayer = (id: string) => EO_LAYERS.find((l) => l.id === id);

/** Public subset sent to the browser (no internal render params needed client-side). */
export type EoLayerInfo = Omit<EoLayer, "render" | "filter">;
