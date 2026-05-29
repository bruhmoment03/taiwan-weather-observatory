# Power BI Report + Embed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real Power BI deliverable to the Taiwan Weather Observatory — CSV data endpoints on the existing Worker, a complete guided build doc, a Power BI theme, and a reference-style `powerbi.html` iframe-embed page wired into the site.

**Architecture:** Extend the existing Cloudflare Worker with path routing so it also serves `/stations.csv` and `/observations.csv` (root `/` JSON stays unchanged). The user builds the report in Power BI Desktop from those CSV URLs using `POWERBI.md` + `theme/powerbi-theme.json`, publishes-to-web, and the resulting iframe URL is dropped into `js/powerbi-embed.js`, which `powerbi.html` reads. A "Power BI" nav link is added to `index.html`.

**Tech Stack:** Cloudflare Workers (JS, ES modules), vanilla HTML/CSS/JS, Power BI Desktop (user-operated), Node.js for headless tests, Python `csv` for endpoint verification.

---

## File structure

| File | Responsibility |
|------|----------------|
| `worker/src/index.js` (modify) | Add `csvStations()`, `csvObservations()`, `toCsv()` helpers + path routing in `fetch()` |
| `POWERBI.md` (create) | Full build guide: Get Data, model, every DAX measure, visuals, publish-to-web, refresh |
| `theme/powerbi-theme.json` (create) | Power BI report theme (paper/ink palette + temp gradient) |
| `powerbi.html` (create) | Reference-style embed page (dark header, Chinese title, iframe slot, CWA footer) |
| `js/powerbi-embed.js` (create) | Holds the publish-to-web URL; injects iframe or a "pending" placeholder |
| `index.html` (modify) | Add "Power BI" link to the nav |

---

## Task 1: CSV helpers + endpoints in the Worker

**Files:**
- Modify: `worker/src/index.js`
- Test: `worker/test/csv.test.mjs` (create)

- [ ] **Step 1: Write the failing test**

Create `worker/test/csv.test.mjs`. It imports the (not-yet-exported) CSV builders and asserts shape with a tiny fixture.

```js
import assert from "node:assert";
import { toCsv, buildCsvStations, buildCsvObservations } from "../src/csv.js";

// toCsv quoting
const csv = toCsv(["A", "B"], [["x,y", 'he said "hi"'], [null, 1]]);
const lines = csv.split("\n");
assert.strictEqual(lines[0], "A,B");
assert.strictEqual(lines[1], '"x,y","he said ""hi"""');
assert.strictEqual(lines[2], ",1"); // null -> empty cell

// fixture mimicking build() output
const payload = {
  latest: [{ id: "466920", name: "臺北", name_en: "Taipei", region: "North",
             county: "Taipei City", lat: 25.0376, lon: 121.5145, elevation_m: 6.3 }],
  timeseries: { "466920": {
    time: ["2026-05-27T01:00:00+08:00", "2026-05-27T02:00:00+08:00"],
    temp: [26.5, null], humidity: [77, 80], pressure: [1002.3, 1002.8],
    wind: [1.4, 0.2], precip: [0.0, 0.0], sunshine: [0.0, 0.0] } },
};
const sCsv = buildCsvStations(payload);
assert.ok(sCsv.startsWith("﻿"), "stations csv has BOM");
assert.strictEqual(sCsv.replace("﻿","").split("\n").length, 2); // header + 1
assert.ok(sCsv.includes("466920") && sCsv.includes("臺北"));

const oCsv = buildCsvObservations(payload);
const oLines = oCsv.replace("﻿","").split("\n");
assert.strictEqual(oLines.length, 3); // header + 2 hours
assert.ok(oLines[0].startsWith("StationID,NameEN,DateTime,Date,Hour,TempC"));
assert.ok(oLines[1].includes("2026-05-27") && oLines[1].includes(",1,")); // Hour col
console.log("csv.test OK");
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node worker/test/csv.test.mjs`
Expected: FAIL — `Cannot find module '../src/csv.js'`.

- [ ] **Step 3: Create `worker/src/csv.js` with the builders**

```js
// CSV builders for the Power BI data endpoints. Pure functions (testable in node).
const BOM = "﻿";

export function toCsv(headers, rows) {
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const out = [headers.join(",")];
  for (const r of rows) out.push(r.map(esc).join(","));
  return out.join("\n");
}

export function buildCsvStations(payload) {
  const headers = ["StationID", "NameEN", "NameZH", "Region", "County", "Lat", "Lon", "ElevationM"];
  const rows = payload.latest.map((s) => [
    s.id, s.name_en, s.name, s.region, s.county, s.lat, s.lon, s.elevation_m,
  ]);
  return BOM + toCsv(headers, rows);
}

export function buildCsvObservations(payload) {
  const headers = ["StationID", "NameEN", "DateTime", "Date", "Hour",
    "TempC", "HumidityPct", "PressureHpa", "WindMs", "WindDir", "PrecipMm", "SunshineHr"];
  const nameById = Object.fromEntries(payload.latest.map((s) => [s.id, s.name_en]));
  // wind_dir is per-station latest only; observations omit it (null) to stay row-accurate.
  const rows = [];
  for (const [sid, ts] of Object.entries(payload.timeseries)) {
    const name = nameById[sid] ?? "";
    for (let i = 0; i < ts.time.length; i++) {
      const dt = ts.time[i];
      rows.push([
        sid, name, dt, dt.slice(0, 10), Number(dt.slice(11, 13)),
        ts.temp[i], ts.humidity[i], ts.pressure[i], ts.wind[i], null, ts.precip[i], ts.sunshine[i],
      ]);
    }
  }
  return BOM + toCsv(headers, rows);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node worker/test/csv.test.mjs`
Expected: `csv.test OK`.

- [ ] **Step 5: Wire endpoints into `worker/src/index.js`**

Add import at top (after the existing `coordsRaw` import):

```js
import { buildCsvStations, buildCsvObservations } from "./csv.js";
```

Add a CSV response helper near `jsonResponse`:

```js
function csvResponse(text, extra = {}) {
  return new Response(text, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
      ...extra,
    },
  });
}
```

In `fetch()`, immediately after the `OPTIONS` short-circuit and the `key` check, branch on pathname. Replace the existing single cache/return block so the shaped `payload` is reused for all three routes:

```js
    const { pathname } = new URL(request.url);

    // Shared cached payload (built once per CACHE_SECONDS).
    const cache = caches.default;
    const cacheKey = new Request(new URL(request.url).origin + "/__cwa_payload", { method: "GET" });
    let payload;
    const cachedPayload = await cache.match(cacheKey);
    if (cachedPayload) {
      payload = await cachedPayload.json();
    } else {
      const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/${DATASET}?Authorization=${key}&format=JSON`;
      let raw;
      try {
        const res = await fetch(url, { cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true } });
        if (!res.ok) return jsonResponse({ error: `CWA API returned HTTP ${res.status}` }, 502);
        raw = await res.json();
      } catch (e) {
        return jsonResponse({ error: `Upstream fetch failed: ${e.message}` }, 502);
      }
      if (String(raw.success).toLowerCase() !== "true") {
        return jsonResponse({ error: "CWA API reported success=false" }, 502);
      }
      payload = build(raw);
      const store = jsonResponse(payload);
      ctx.waitUntil(cache.put(cacheKey, store.clone()));
    }

    if (pathname === "/stations.csv") return csvResponse(buildCsvStations(payload));
    if (pathname === "/observations.csv") return csvResponse(buildCsvObservations(payload));
    return jsonResponse(payload, 200, { "Cache-Control": `public, max-age=${CACHE_SECONDS}` });
```

Remove the now-duplicated old fetch/cache/return block that previously followed the `key` check.

- [ ] **Step 6: Local end-to-end test of the Worker module logic**

Create + run a temp harness that imports `build` is not needed — instead verify via the live fetch after deploy (Step 8). First confirm csv.js still passes and index.js parses:

Run: `node --check worker/src/index.js && node --check worker/src/csv.js && node worker/test/csv.test.mjs`
Expected: `csv.test OK` (no syntax errors).

- [ ] **Step 7: Deploy the Worker**

Run: `cd worker && npx --yes wrangler@latest deploy`
Expected: `Uploaded taiwan-weather-proxy` and a deployment URL.

- [ ] **Step 8: Verify live endpoints (Python csv parse)**

Run a check that curls both CSVs and asserts row counts and columns:

```bash
BASE="https://taiwan-weather-proxy.ii96391799.workers.dev"
curl -s "$BASE/stations.csv" -o s.csv
curl -s "$BASE/observations.csv" -o o.csv
python - <<'PY'
import csv
s=list(csv.reader(open('s.csv',encoding='utf-8-sig')))
o=list(csv.reader(open('o.csv',encoding='utf-8-sig')))
assert s[0]==['StationID','NameEN','NameZH','Region','County','Lat','Lon','ElevationM'], s[0]
assert len(s)-1==31, f"stations rows {len(s)-1}"
assert o[0][:6]==['StationID','NameEN','DateTime','Date','Hour','TempC'], o[0]
assert len(o)-1==31*24, f"obs rows {len(o)-1}"
print("ENDPOINTS OK:", len(s)-1, "stations,", len(o)-1, "observations")
PY
rm -f s.csv o.csv
```
Expected: `ENDPOINTS OK: 31 stations, 744 observations`. Also confirm root JSON still serves: `curl -s -o /dev/null -w "%{http_code}\n" "$BASE/"` → `200`.

- [ ] **Step 9: Commit**

```bash
git add worker/src/index.js worker/src/csv.js worker/test/csv.test.mjs
git commit -m "feat(worker): add /stations.csv and /observations.csv endpoints for Power BI"
```

---

## Task 2: Power BI theme

**Files:**
- Create: `theme/powerbi-theme.json`

- [ ] **Step 1: Create the theme**

```json
{
  "name": "Taiwan Weather Observatory",
  "dataColors": ["#2166ac", "#4393c3", "#92c5de", "#f4a582", "#d6604d", "#b2182b", "#8a877f"],
  "background": "#fbfaf7",
  "foreground": "#1a1916",
  "tableAccent": "#c0392b",
  "good": "#2166ac",
  "neutral": "#8a877f",
  "bad": "#b2182b",
  "visualStyles": {
    "*": {
      "*": {
        "background": [{ "color": { "solid": { "color": "#ffffff" } } }],
        "border": [{ "color": { "solid": { "color": "#e7e3da" } }, "radius": 8 }],
        "title": [{ "fontColor": { "solid": { "color": "#1a1916" } }, "fontFamily": "Segoe UI Semibold", "fontSize": 12 }]
      }
    }
  }
}
```

- [ ] **Step 2: Validate it parses**

Run: `python -c "import json; json.load(open('theme/powerbi-theme.json',encoding='utf-8')); print('theme JSON OK')"`
Expected: `theme JSON OK`.

- [ ] **Step 3: Commit**

```bash
git add theme/powerbi-theme.json
git commit -m "feat: add Power BI report theme"
```

---

## Task 3: Embed page + URL holder

**Files:**
- Create: `js/powerbi-embed.js`
- Create: `powerbi.html`
- Test: `test/embed.test.mjs` (create, repo root)

- [ ] **Step 1: Write the failing test**

Create `test/embed.test.mjs`. It loads `js/powerbi-embed.js` with a stubbed DOM and asserts the placeholder renders when the URL is empty, and an iframe renders when set.

```js
import assert from "node:assert";

function stubDom() {
  const el = {
    _html: "", set innerHTML(v){this._html=v;}, get innerHTML(){return this._html;},
    style: {}, appendChild(){}, setAttribute(){},
  };
  global.document = { getElementById: () => el, createElement: () => ({ style:{}, setAttribute(){} }) };
  return el;
}

// empty URL -> placeholder
let el = stubDom();
let mod = await import(`../js/powerbi-embed.js?empty=${Date.now()}`);
mod.renderEmbed("");
assert.ok(/pending|publishing/i.test(el.innerHTML), "shows pending placeholder");

// real URL -> iframe with that src
el = stubDom();
mod.renderEmbed("https://app.powerbi.com/view?r=ABC123");
assert.ok(el.innerHTML.includes("<iframe"), "renders iframe");
assert.ok(el.innerHTML.includes("app.powerbi.com/view?r=ABC123"), "iframe has src");
console.log("embed.test OK");
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node test/embed.test.mjs`
Expected: FAIL — cannot find `../js/powerbi-embed.js`.

- [ ] **Step 3: Create `js/powerbi-embed.js`**

```js
// Holds the Power BI "Publish to web" URL and renders it into #pbi-slot.
// Set EMBED_URL after publishing the report (Power BI Service -> File -> Embed report -> Publish to web).
export const EMBED_URL = ""; // e.g. "https://app.powerbi.com/view?r=eyJrIjoi..."

export function renderEmbed(url = EMBED_URL) {
  const slot = document.getElementById("pbi-slot");
  if (!slot) return;
  if (!url) {
    slot.innerHTML = `
      <div class="pending">
        <h2>報表發布中 · Report publishing</h2>
        <p>The Power BI report is being published to the web. The live dashboard will appear here once the embed link is connected.</p>
      </div>`;
    return;
  }
  slot.innerHTML = `<iframe title="Taiwan Weather Power BI dashboard"
      src="${url}" frameborder="0" allowfullscreen="true"></iframe>`;
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => renderEmbed());
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node test/embed.test.mjs`
Expected: `embed.test OK`.

- [ ] **Step 5: Create `powerbi.html` (reference style, dark header)**

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>台灣天氣即時儀表板 (Power BI)</title>
  <meta name="description" content="台灣天氣即時儀表板，使用 Power BI 與中央氣象署開放資料。" />
  <style>
    :root { --ink:#1f2937; --accent:#c0392b; }
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", system-ui, Arial, sans-serif; margin:0; background:#f4f6f9; color:#1a1916; }
    .header { background:var(--ink); color:#fff; padding:26px 20px; text-align:center; }
    .header h1 { margin:0; font-size:clamp(22px,4vw,32px); letter-spacing:.01em; }
    .header p { margin:8px 0 0; color:#cbd5e1; font-size:14px; }
    .header .made { margin-top:10px; font-size:13px; color:#94a3b8; }
    .header a.back { color:#cbd5e1; text-decoration:none; font-size:13px; border-bottom:1px solid #475569; }
    .container { max-width:1200px; margin:0 auto; padding:24px 20px 48px; }
    #pbi-slot iframe { width:100%; aspect-ratio:16/10; min-height:560px; border:none; border-radius:12px; box-shadow:0 2px 18px rgba(0,0,0,.18); background:#fff; }
    .pending { background:#fff; border:1px dashed #cbd5e1; border-radius:12px; padding:64px 28px; text-align:center; color:#475569; }
    .pending h2 { font-size:20px; margin:0 0 10px; color:#1f2937; }
    .footer { margin-top:22px; color:#666; font-size:13px; text-align:center; }
    .footer a { color:#475569; }
  </style>
</head>
<body>
  <div class="header">
    <h1>台灣天氣即時儀表板 (Power BI)</h1>
    <p>Power BI + CWA Open Data API</p>
    <div class="made">made by Speedo</div>
    <div style="margin-top:10px;"><a class="back" href="./index.html">← 回到主儀表板 / Back to main dashboard</a></div>
  </div>
  <div class="container">
    <div id="pbi-slot"></div>
    <div class="footer">資料來源：中央氣象署（CWA）開放資料平台 ·
      <a href="https://opendata.cwa.gov.tw/" target="_blank" rel="noopener">opendata.cwa.gov.tw</a>
    </div>
  </div>
  <script type="module" src="./js/powerbi-embed.js"></script>
</body>
</html>
```

- [ ] **Step 6: Commit**

```bash
git add powerbi.html js/powerbi-embed.js test/embed.test.mjs
git commit -m "feat: add reference-style Power BI embed page with pending placeholder"
```

---

## Task 4: Nav link from the main site

**Files:**
- Modify: `index.html` (the `.nav` block)

- [ ] **Step 1: Add the link**

In `index.html`, change the nav block to add a Power BI link after "Compare":

```html
    <nav class="nav" aria-label="Sections">
      <a href="#overview">Overview</a>
      <a href="#map">Map</a>
      <a href="#trends">Trends</a>
      <a href="#compare">Compare</a>
      <a href="./powerbi.html">Power BI</a>
    </nav>
```

- [ ] **Step 2: Verify the link is present**

Run: `grep -c 'href="./powerbi.html"' index.html`
Expected: `1`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: link Power BI page from main nav"
```

---

## Task 5: POWERBI.md build guide

**Files:**
- Create: `POWERBI.md`

- [ ] **Step 1: Write the guide**

Create `POWERBI.md` containing, in order:
1. **Prerequisites** — Power BI Desktop (free), a personal Power BI account.
2. **Get Data** — Home → Get data → Web → two queries, each with one of:
   - `https://taiwan-weather-proxy.ii96391799.workers.dev/stations.csv`
   - `https://taiwan-weather-proxy.ii96391799.workers.dev/observations.csv`
   Set first row as headers; confirm types (Lat/Lon/Elevation decimal; Hour whole number; DateTime date/time).
3. **Model** — Model view → drag `Stations[StationID]` onto `Observations[StationID]` (1-to-many, single).
4. **Measures** — exact DAX for all measures (copy each into Modeling → New measure):

```
Latest Time = MAX( Observations[DateTime] )
Current Temp = CALCULATE( AVERAGE(Observations[TempC]), Observations[DateTime] = [Latest Time] )
Island Avg Temp = AVERAGEX( VALUES(Stations[StationID]), [Current Temp] )
Avg Temp 24h = AVERAGE( Observations[TempC] )
Max Temp 24h = MAX( Observations[TempC] )
Min Temp 24h = MIN( Observations[TempC] )
Current Humidity = CALCULATE( AVERAGE(Observations[HumidityPct]), Observations[DateTime] = [Latest Time] )
Current Wind = CALCULATE( AVERAGE(Observations[WindMs]), Observations[DateTime] = [Latest Time] )
Total Rain 24h = SUM( Observations[PrecipMm] )
Stations Reporting = CALCULATE( DISTINCTCOUNT(Observations[StationID]), NOT(ISBLANK(Observations[TempC])) )
Hottest Station =
VAR t = ADDCOLUMNS( VALUES(Stations[NameEN]), "@T", [Current Temp] )
RETURN MAXX( TOPN(1, t, [@T], DESC), Stations[NameEN] & " · " & FORMAT([@T],"0.0") & "°C" )
Coldest Station =
VAR t = ADDCOLUMNS( VALUES(Stations[NameEN]), "@T", [Current Temp] )
RETURN MINX( TOPN(1, t, [@T], ASC), Stations[NameEN] & " · " & FORMAT([@T],"0.0") & "°C" )
As Of = "Updated " & FORMAT( [Latest Time], "yyyy-mm-dd HH:mm" )
```

5. **Theme** — View → Themes → Browse for themes → select `theme/powerbi-theme.json`.
6. **Visuals (Overview page)** — explicit per-visual field wells:
   - 4 Card visuals: `Island Avg Temp`, `Hottest Station`, `Coldest Station`, `Stations Reporting`.
   - Map: Location = `Stations[Lat]`,`Stations[Lon]` (or add a Lat/Lon → use Azure Map: Latitude=Lat, Longitude=Lon), Bubble size = `Current Temp`, legend/colour = `Current Temp`.
   - Clustered bar chart: Y = `Stations[NameEN]`, X = `Current Temp`, sort descending.
   - Line chart: X = `Observations[Hour]`, Y = `Avg Temp 24h`.
   - Slicer: `Stations[Region]`.
   - Table: `NameEN`, `Current Temp`, `Current Humidity`, `Current Wind`, `Total Rain 24h`.
   - Title textbox: bind to `As Of` (or a card).
7. **Publish to web** — Save `.pbix` → Home → Publish → to "My workspace" → in Power BI Service open the report → File → Embed report → **Publish to web (public)** → Create embed code → copy the `https://app.powerbi.com/view?r=...` **src** URL.
8. **Connect the embed** — paste that URL into `js/powerbi-embed.js` `EMBED_URL`, commit, push.
9. **Scheduled refresh** — Service → dataset → Settings → Scheduled refresh → On (free tier up to 8/day). Note: publish-to-web embeds update within ~1 hour of a refresh.
10. **Troubleshooting** — if "Publish to web" is greyed out, the tenant disabled it → use a personal account; if Chinese names show as mojibake, the BOM handles it but ensure the query used the CSV URL (not JSON).

- [ ] **Step 2: Sanity-check the doc has all measures**

Run: `grep -c "=" POWERBI.md` (expect many) and `grep -c "app.powerbi.com/view" POWERBI.md` → at least `1`.
Expected: non-zero counts.

- [ ] **Step 3: Commit**

```bash
git add POWERBI.md
git commit -m "docs: add Power BI build + publish guide"
```

---

## Task 6: QA test + push

- [ ] **Step 1: Run all headless tests together**

```bash
node worker/test/csv.test.mjs && node test/embed.test.mjs && \
python -c "import json; json.load(open('theme/powerbi-theme.json',encoding='utf-8')); print('theme OK')"
```
Expected: `csv.test OK`, `embed.test OK`, `theme OK`.

- [ ] **Step 2: Re-verify live endpoints + that the website still works**

```bash
BASE="https://taiwan-weather-proxy.ii96391799.workers.dev"
curl -s -o /dev/null -w "json %{http_code}\n" "$BASE/"
curl -s "$BASE/stations.csv" | head -1
curl -s -o /dev/null -w "stations %{http_code}\n" "$BASE/stations.csv"
curl -s -o /dev/null -w "observations %{http_code}\n" "$BASE/observations.csv"
```
Expected: `json 200`, header row prints, `stations 200`, `observations 200`.

- [ ] **Step 3: Serve the site locally and confirm powerbi.html + placeholder**

Start `python -m http.server 8787` (high port; 8000 is blocked on this box). Then:
```bash
curl -s -o /dev/null -w "powerbi.html %{http_code}\n" http://127.0.0.1:8787/powerbi.html
curl -s http://127.0.0.1:8787/powerbi.html | grep -c "台灣天氣即時儀表板"
curl -s -o /dev/null -w "embed.js %{http_code}\n" http://127.0.0.1:8787/js/powerbi-embed.js
curl -s http://127.0.0.1:8787/index.html | grep -c 'href="./powerbi.html"'
```
Expected: `powerbi.html 200`, count `1`, `embed.js 200`, count `1`.

- [ ] **Step 4: Push and confirm live Pages**

```bash
git push origin main
```
Then poll until live:
```bash
for i in $(seq 1 20); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://bruhmoment03.github.io/taiwan-weather-observatory/powerbi.html")
  [ "$code" = "200" ] && { echo "live powerbi.html 200 after ~$((i*6))s"; break; }
  sleep 6
done
```
Expected: `live powerbi.html 200`.

- [ ] **Step 5: Final report to user**

Summarize what's deployed, the live `powerbi.html` URL (showing the "pending" placeholder), and hand off the `POWERBI.md` steps the user runs in Desktop, ending with sending the embed URL back.

---

## Self-review notes
- **Spec coverage:** endpoints (Task 1) ✓; model+DAX+theme+visuals (Tasks 2,5) ✓; embed page+placeholder (Task 3) ✓; nav link (Task 4) ✓; refresh+publish (Task 5) ✓; verification (Task 6) ✓.
- **Decision:** `observations.csv` omits per-row wind direction (the source only provides a latest wind_dir per station, not per hour) — documented in `buildCsvObservations`. Wind direction still available via the table/cards from `latest` if needed later; not required by the planned visuals.
- **Types:** `renderEmbed(url)`, `EMBED_URL`, `#pbi-slot`, `buildCsvStations/Observations(payload)`, `toCsv(headers, rows)` are consistent across plan and tests.
