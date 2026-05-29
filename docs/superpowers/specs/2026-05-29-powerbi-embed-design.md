# Power BI report + embed — design spec

**Date:** 2026-05-29 · **Author credit:** made by Speedo
**Project:** Taiwan Weather Observatory (`D:\bi-final`)

## Context
The dashboard at https://bruhmoment03.github.io/taiwan-weather-observatory/ is a
custom web app — *styled* like a BI tool but not actual Microsoft Power BI. The user
wants a **real Power BI report** built from the same CWA data and **embedded via
`<iframe>`** on the site, presented in the style of the reference repo
`hminmis-max/tw-weather` (Chinese title + "(Power BI)" + author credit).

Confirmed decisions:
- **Real Power BI**, data **live from the existing Cloudflare Worker** (no API key in the file).
- **Guided build**: assistant prepares every artifact; user does the Desktop clicks
  (Power BI Desktop is a GUI the assistant cannot operate; this also avoids brittle
  hand-authored `.pbix`/`.pbip` files).
- **Lives in the current repo**: new `powerbi.html` embed page + `POWERBI.md` guide + nav link.
- **Bilingual framing**: 台灣天氣即時儀表板 (Power BI) / Taiwan Real-time Weather Dashboard, made by Speedo.
- Personal Power BI account + Desktop (so "Publish to web" public embed is available).

## Hard constraints
- Assistant **cannot** operate Power BI Desktop or perform "Publish to web" — the user
  does those steps; assistant supplies data, DAX, theme, a step-by-step guide, and the page.
- The **iframe URL only exists after** the user publishes-to-web; assistant wires it in afterward.
- Publish-to-web renders **public, read-only**; refreshes propagate to the embed within ~1 hour.

## Architecture
```
Cloudflare Worker (taiwan-weather-proxy.ii96391799.workers.dev)
  ├─ /                 -> JSON  (existing; powers the website)        [unchanged]
  ├─ /stations.csv     -> 31 rows  (dimension)                         [NEW]
  └─ /observations.csv -> 744 rows = 31 stations x 24 h (fact)         [NEW]
            │
            ▼  Power BI Desktop: Get Data > Web (CSV URL)
   Star model: Stations[StationID] 1──* Observations[StationID]
            │  + ~12 DAX measures, import a light theme JSON
            ▼  Save .pbix > Publish > Publish to web (personal account)
        public iframe URL
            │
            ▼  pasted into js/powerbi-embed.js
   GitHub Pages: powerbi.html  (iframe + bilingual header), nav link from index.html
```

## Components

### 1. Worker CSV endpoints (assistant builds & deploys) — `worker/src/index.js`
Add path routing. Reuse the existing `build()` output:
- `/stations.csv` columns: `StationID, NameEN, NameZH, Region, County, Lat, Lon, ElevationM`
- `/observations.csv` columns: `StationID, NameEN, DateTime, Date, Hour, TempC, HumidityPct,
  PressureHpa, WindMs, WindDir, PrecipMm, SunshineHr`
- CSV rules: header row; quote fields containing commas/quotes; empty cell for null;
  `Content-Type: text/csv; charset=utf-8`; `Access-Control-Allow-Origin: *`; reuse 10-min cache.
- Root `/` JSON behaviour unchanged (website keeps working).
- BOM (`﻿`) prefixed so Excel/Power BI read Chinese (中文 names) correctly.

### 2. Model & DAX (assistant writes; user pastes) — documented in `POWERBI.md`
- **Stations** dimension (from stations.csv), **Observations** fact (from observations.csv).
- Relationship `Stations[StationID]` → `Observations[StationID]` (single, 1-to-many).
- Mark `Date`/`DateTime` as date; `Hour` whole number.
- ~12 measures, e.g.:
  - `Latest Time = MAX(Observations[DateTime])`
  - `Current Temp = CALCULATE(AVERAGE(Observations[TempC]), Observations[DateTime] = [Latest Time])`
  - `Island Avg Temp`, `Max Temp 24h`, `Min Temp 24h`, `Avg Temp 24h`
  - `Current Humidity`, `Current Wind`, `Total Rain 24h`
  - `Hottest Station` / `Coldest Station` (name via TOPN/MAXX), `Stations Reporting`
  - `As Of = "Updated " & FORMAT([Latest Time], "yyyy-mm-dd HH:mm")`

### 3. Report page "Overview" (assistant gives visual-by-visual guide + theme JSON)
Editorial light look matching the site. Visuals:
- KPI cards: Island Avg · Hottest (name+°C) · Coldest (name+°C) · Stations Reporting
- Map (bubble, lat/lon, size/colour by Current Temp)
- Bar: current temp per station, sorted hottest→coldest
- Line: Avg temp across Hour (24h)
- Slicer: Region (and/or Station) · Table: per-station detail
- Optional page 2: single-station 24h drill.
- `theme/powerbi-theme.json`: paper/ink palette + blue→red temperature data colours.

### 4. Embed page (assistant builds) — `powerbi.html`, `js/powerbi-embed.js`, `css` reuse
- Bilingual header: 台灣天氣即時儀表板 (Power BI) / Taiwan Real-time Weather Dashboard · made by Speedo.
- Responsive 16:9 iframe wrapper; the embed URL kept in `js/powerbi-embed.js` (one place to update).
- Until the URL is supplied: a styled placeholder card ("Report publishing — embed pending").
- Add **"Power BI"** link to the nav in `index.html`; add a back-link to the main dashboard.

### 5. Refresh (user, guided)
Power BI Service → dataset → Scheduled refresh (free tier ~8×/day) re-pulls Worker CSVs.

## Work split
- **Assistant now:** deploy CSV endpoints; verify they parse (31 / 744 rows); write `POWERBI.md`
  (model + every DAX measure + visual steps + publish-to-web + refresh); `theme/powerbi-theme.json`;
  `powerbi.html` + `js/powerbi-embed.js` (placeholder URL) + nav link; commit & push.
- **User (guided live):** Desktop → Get Data (the two CSV URLs) → build per guide → Save `.pbix`
  → Publish → Publish to web → send embed URL. Assistant pastes URL, commits, verifies live.

## Verification
- **Endpoints:** `curl /stations.csv` → 1 header + 31 rows; `/observations.csv` → 1 header + 744
  rows; both `text/csv`, CORS `*`; load each into Python `csv` to confirm column counts & types;
  confirm root `/` JSON still 200 with 31 stations (website unaffected).
- **Embed page:** serve locally; with placeholder it shows the styled "pending" card and nav link
  works; after URL set, the iframe element points at the publish-to-web URL.
- **Live:** after push, Pages serves `powerbi.html`; once the user publishes, confirm the iframe renders.

## Out of scope / risks
- Cannot guarantee a specific corporate tenant allows publish-to-web — mitigated by user's
  personal account choice.
- Hand-authored `.pbix`/`.pbip` explicitly avoided (brittle) in favour of the guided build.
