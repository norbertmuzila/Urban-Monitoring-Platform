export interface Place {
  id: string;
  label: string;
  hint: string;
  lat: number;
  lng: number;
  zoom: number;
  /** ISO alpha-2 (lowercase) for the flag. */
  iso2?: string;
}

/** Zimbabwe focus areas for mining, land degradation and urban monitoring. */
export const ZIMBABWE_PLACES: Place[] = [
  { id: "harare", label: "Harare", hint: "Urban growth & heat", lat: -17.8292, lng: 31.0522, zoom: 12, iso2: "zw" },
  { id: "kwekwe", label: "Kwekwe gold belt", hint: "Artisanal gold", lat: -18.93, lng: 29.82, zoom: 11, iso2: "zw" },
  { id: "shurugwi", label: "Great Dyke · Shurugwi", hint: "Chrome & gold", lat: -19.67, lng: 30.0, zoom: 11, iso2: "zw" },
  { id: "mazowe", label: "Mazowe valley", hint: "Alluvial panning", lat: -17.5, lng: 30.97, zoom: 11, iso2: "zw" },
  { id: "penhalonga", label: "Penhalonga · Odzi", hint: "River siltation", lat: -18.89, lng: 32.68, zoom: 11, iso2: "zw" },
  { id: "gokwe", label: "Gokwe", hint: "Woodland clearing", lat: -18.22, lng: 28.93, zoom: 10, iso2: "zw" },
  { id: "chipinge", label: "Chimanimani · Chipinge", hint: "Cyclone scars", lat: -19.9, lng: 32.8, zoom: 10, iso2: "zw" },
  { id: "hwange", label: "Hwange", hint: "Coal & fire corridor", lat: -18.36, lng: 26.5, zoom: 10, iso2: "zw" },
];
