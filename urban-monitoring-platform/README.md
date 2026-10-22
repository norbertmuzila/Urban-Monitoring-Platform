# Urban Monitoring Platform · v2.3

Live environmental intelligence for every city on Earth — air quality, weather, satellite imagery,
forests and fires — with predictions you can verify. Built for the EuroMoonMars programme as the
full-stack successor to the single-file v1 site
([norbertmuzila.github.io/Urban-Monitoring-Platform](https://norbertmuzila.github.io/Urban-Monitoring-Platform/)).

**Stack:** Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 ·
Lucide icons · Chart.js · Leaflet · SWR · Zod — deployed on Vercel. No API keys required.

## Pages

| Route        | What it does                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| `/`          | Overview of the whole platform: live counters, quick location picker, module guide, live satellites and fires   |
| `/dashboard` | **City monitor** — pick any country → state/province → city/town; live conditions, 72 h prediction with verified accuracy, satellite view, largest cities in the country, World Bank context |
| `/explorer`  | Satellite explorer — 15 live layers (Sentinel-1/2, Landsat 8/9, ALOS-2, Copernicus DEM, ESA WorldCover, VIIRS) with before/after swipe |
| `/forests`   | Forests & fires for every country — forest area 1990–latest, change since 2000 ranking, NASA VIIRS fires (24 h) |
| `/zimbabwe`  | Zimbabwe land & mining watch — 91 districts, VIIRS fires, OSM mine sites, per-district satellite screening      |
| `/sources`   | Data sources, licences, live service health and latest satellite acquisitions                                   |

Addresses stay clean (`/dashboard`, `/forests`, `/explorer`): the selected city is kept in the browser and
links between pages hand over their country, layer or place without query strings. Older links with
query strings still open the right view and are then tidied. Old v2.0 routes (`/map`, `/model`, `/pipeline`,
`/deforestation`) redirect to their replacements.

## Locations

246 countries and territories, 3,837 states/provinces and 171,503 populated places (≥ 1,000 people)
from GeoNames, bundled as a snapshot (`npm run data:geo` to refresh). Any smaller town or village
is found by typing — the picker queries the GeoNames-based geocoder restricted to the chosen country.

## Prediction models (run in the background)

`/api/predict?lat=&lng=` trains two models per location (≈1 km grid) on 92 days of hourly data,
retrained hourly and cached:

- **Temperature (MOS):** per lead day 1–3, learns a correction to the operational ECMWF/DWD forecast
  from archived forecasts vs. the realised temperature (diurnal cycle, humidity, wind, cloud, recent bias).
- **PM2.5:** direct 1–72 h model correcting the past week's daily cycle with current anomalies, their
  decay and the weather forecast for each target hour. The CAMS operational forecast is shown alongside.

Evaluation is strictly time-ordered: **train → validation week → test week**. The validation week
chooses between the plain baseline, simple rules (bias-adjusted forecast, damped persistence) and
ridge corrections; a correction must beat the best rule by 3 %. The **test week is never seen** by
training or selection, and its errors are what the City monitor reports — including when the
published prediction is *not* better than the baseline. The 80 % band comes from test-week errors.

No forecast is 100 % accurate; the platform's commitment is that every accuracy figure is measured
on unseen data at that location, and every input links to the exact upstream request.

## Architecture

```
Browser (React client components, SWR, Leaflet)
   │  same-origin JSON                          │  map tiles (direct, CDN-cached)
   ▼                                            ▼
Route Handlers  src/app/api/**          Planetary Computer Titiler · NASA GIBS · basemaps
   │  zod validation, JSON errors, CDN Cache-Control
Server services src/lib/server/**       ← "use cache" + cacheLife, timeouts, retries
   │  model/  (ridge regression, selection, verification)
Open-Meteo · Planetary Computer · NASA FIRMS · World Bank · RainViewer · bundled GeoNames/Natural Earth
```

## API

| Endpoint                                              | Description                                               |
| ----------------------------------------------------- | --------------------------------------------------------- |
| `GET /api/geo/countries`                              | All countries & territories                               |
| `GET /api/geo/countries/:iso2`                        | Country with states/provinces and largest cities          |
| `GET /api/geo/countries/:iso2/cities[?state=]`        | Cities ≥ 1,000 people, largest first                      |
| `GET /api/geocode?q=&country=`                        | Place search, optionally within one country               |
| `GET /api/environment?lat=&lng=`                      | Live weather + air quality, 24 h history, source URLs     |
| `GET /api/predict?lat=&lng=`                          | 72 h temperature & PM2.5 predictions with test-week errors |
| `GET /api/country/:iso2`                              | World Bank indicators + VIIRS fires (24 h)                |
| `GET /api/country/:iso2/{fires,shape,cities-live,export}` | Fires GeoJSON, outline, live big-city AQI, CSV export |
| `GET /api/forest/ranking`                             | Forest change since 2000, all countries                   |
| `GET /api/eo/{layers,tiles,scenes,status}`            | Satellite layer catalogue, tiles, scenes, latest passes   |
| `GET /api/zw/{overview,districts,fires,sites}` · `/api/zw/districts/:id/analysis` | Zimbabwe watch |
| `GET /api/stats` · `/api/health` · `/api/radar`       | Headline figures, provider health, rain radar             |

Invalid input → `400` with field errors; unknown resources → `404`; upstream outages → `502`.

## Data provenance

All data is live from open sources, or from dated open-licence snapshots: Open-Meteo (ECMWF/DWD/CAMS,
CC BY 4.0), Microsoft Planetary Computer (Copernicus Sentinel, USGS Landsat, JAXA, ESA), NASA FIRMS
and GIBS, World Bank WDI (CC BY 4.0), GeoNames (CC BY 4.0), Natural Earth (public domain),
geoBoundaries (CC BY 3.0 IGO), OpenStreetMap (ODbL), RainViewer. Nothing is simulated.

## Develop

```bash
npm install
npm run dev            # http://localhost:3000
npm run build          # production build (type-checks)
npm run lint
npm run data:geo       # refresh countries / states / cities / outlines
npm run data:zimbabwe  # refresh Zimbabwe districts + OSM mining sites
```

## Deploy to Vercel

1. Push the repository to GitHub.
2. In Vercel: **Add New → Project**, import the repo, and set **Root Directory** to `urban-monitoring-platform`.
3. Framework preset is detected as Next.js — deploy. Every push to `main` redeploys; PRs get preview URLs.

Or from this folder with the CLI: `npx vercel` (preview) and `npx vercel --prod`.
