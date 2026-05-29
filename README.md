# Taiwan Weather Observatory

A live, editorial-style dashboard of temperature and weather across Taiwan's **31
official weather stations**, built on the Central Weather Administration (CWA)
open-data API and hosted free on GitHub Pages.

> Dataset: `C-B0024-001` — hourly observations from CWA staffed stations.

## What it shows

- **Overview** — national hot/cold extremes, island average, and a featured-station
  readout (temperature, humidity, wind, pressure, rain, sunshine) with a 24-hour range.
- **Map** — every station plotted and coloured by current temperature, filterable by
  region; click a marker to feature that station everywhere.
- **Trends** — the last 24 hours for the featured station against the national spread
  (shaded min–max band + island-average line), for any metric.
- **Compare & rank** — a hottest-to-coldest league table and a scatter that reveals
  altitude as the island's dominant temperature control (temp vs. elevation / humidity).

## How it works

```
CWA API ──(GitHub Action, hourly)──> scripts/fetch_data.py ──> data/*.json (committed)
                                                                    │
                          GitHub Pages serves index.html ──reads──> data/*.json
                                          │
                        ECharts (charts) + Leaflet (map), vanilla ES modules
```

The site is **fully static** — no backend, no build step. A scheduled GitHub Action
fetches and cleans the data so the API key is never exposed in the browser.

## Local development

```bash
# 1. Generate the data (needs your CWA key)
export CWA_API_KEY="CWA-XXXX..."        # PowerShell: $env:CWA_API_KEY="CWA-XXXX..."
python scripts/fetch_data.py

# 2. Serve the site
python -m http.server 8000
# open http://localhost:8000
```

`fetch_data.py` uses only the Python standard library — no `pip install` needed.

## Deploying

1. Push this repo to GitHub.
2. **Settings → Secrets and variables → Actions** → add secret `CWA_API_KEY`.
3. **Settings → Pages** → Source: *Deploy from a branch* → `main` / root.
4. **Actions → Update weather data → Run workflow** to populate fresh data.

The hourly cron then keeps `data/*.json` current and Pages re-publishes automatically.

## Project layout

| Path | Purpose |
|------|---------|
| `index.html` | Page structure |
| `css/styles.css` | Editorial design system |
| `js/data.js` | Data loading, temperature colour scale, formatters |
| `js/state.js` | Shared station/metric selection (pub/sub) |
| `js/views/*.js` | `current`, `map`, `trends`, `compare` views |
| `scripts/fetch_data.py` | CWA fetch + clean + shape pipeline |
| `data/station_coords.json` | Curated station coordinates & elevation |
| `data/*.json` | Generated: `meta`, `latest`, `timeseries` |
| `.github/workflows/update-data.yml` | Hourly data refresh |

## Data & attribution

Source: [CWA Open Data](https://opendata.cwa.gov.tw/), dataset `C-B0024-001`.
Station coordinates and elevations are curated in `data/station_coords.json`.
This is an independent visualisation and not an official CWA product.
