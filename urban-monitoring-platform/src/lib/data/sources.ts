/** Every upstream data provider used by the platform. */
export const DATA_SOURCES = [
  { name: "Open-Meteo Forecast (ECMWF, DWD ICON, NOAA GFS best match)", use: "Live weather, 24 h history, forecasts", refresh: "Every 15 min", license: "CC BY 4.0", url: "https://open-meteo.com/en/docs" },
  { name: "Open-Meteo Previous Runs", use: "Archived forecasts to train & verify the temperature model", refresh: "Hourly", license: "CC BY 4.0", url: "https://open-meteo.com/en/docs/previous-runs-api" },
  { name: "Copernicus CAMS via Open-Meteo Air Quality", use: "European AQI, PM2.5, PM10, NO₂, O₃, SO₂, CO", refresh: "Hourly", license: "Copernicus licence", url: "https://open-meteo.com/en/docs/air-quality-api" },
  { name: "GeoNames", use: "Every country, state/province and populated place (≥1,000 people) plus live place search", refresh: "Snapshot + live search", license: "CC BY 4.0", url: "https://www.geonames.org/" },
  { name: "World Bank World Development Indicators", use: "Population, urbanisation, PM2.5 exposure, forest area, protected land, CO₂", refresh: "Several times a year", license: "CC BY 4.0", url: "https://data.worldbank.org/" },
  { name: "NASA FIRMS (VIIRS 375 m, NOAA-20)", use: "Active fires worldwide, last 24 h / 7 days", refresh: "Within 3 h of overpass", license: "NASA open data", url: "https://firms.modaps.eosdis.nasa.gov/" },
  { name: "Microsoft Planetary Computer (STAC + Titiler)", use: "Sentinel-1/2, Landsat 8/9, ALOS-2, ALOS World 3D DEM, ESA WorldCover — tiles & zonal statistics", refresh: "As acquired (≤5 days)", license: "Per collection (Copernicus, USGS, JAXA, ESA)", url: "https://planetarycomputer.microsoft.com/catalog" },
  { name: "NASA GIBS", use: "VIIRS Day/Night Band night-time lights", refresh: "Daily", license: "NASA open data", url: "https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api" },
  { name: "RainViewer", use: "Precipitation radar mosaics", refresh: "Every 10 min", license: "Free use with attribution", url: "https://www.rainviewer.com/api.html" },
  { name: "geoBoundaries / ZIMSTAT", use: "Zimbabwe ADM2 district boundaries", refresh: "Snapshot", license: "CC BY 3.0 IGO", url: "https://www.geoboundaries.org/" },
  { name: "OpenStreetMap (Overpass)", use: "Mapped quarries, mines and shafts in Zimbabwe", refresh: "Snapshot", license: "ODbL 1.0", url: "https://www.openstreetmap.org/copyright" },
  { name: "Natural Earth", use: "Country outlines for fire assignment and maps", refresh: "Snapshot", license: "Public domain", url: "https://www.naturalearthdata.com/" },
];
