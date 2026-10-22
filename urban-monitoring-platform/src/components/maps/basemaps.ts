import { Map as MapIcon, Moon, Satellite } from "lucide-react";

export type BasemapId = "dark" | "street" | "satellite";

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";

/** Key-free basemaps. Each is a base layer plus an optional label overlay. */
export const BASEMAPS: Record<BasemapId, { label: string; layers: { url: string; attribution?: string }[] }> = {
  dark: {
    label: "Dark",
    layers: [
      { url: `${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, attribution: "&copy; Esri, HERE, Garmin, USGS" },
      { url: `${ESRI}/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}` },
    ],
  },
  street: {
    label: "Streets",
    layers: [{ url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "&copy; OpenStreetMap contributors" }],
  },
  satellite: {
    label: "Satellite",
    layers: [
      { url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, attribution: "&copy; Esri, Maxar, Earthstar Geographics" },
      { url: `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}` },
    ],
  },
};

export const BASEMAP_OPTIONS = [
  { value: "dark" as const, label: "Dark", icon: Moon },
  { value: "street" as const, label: "Streets", icon: MapIcon },
  { value: "satellite" as const, label: "Satellite", icon: Satellite },
];
