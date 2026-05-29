# Power BI build guide — 台灣天氣即時儀表板

This guide builds a real Microsoft Power BI report from the same CWA weather data
that powers the website, then publishes it so it can be embedded in `powerbi.html`
via an `<iframe>`. You run these steps in **Power BI Desktop**; everything you need
(data URLs, DAX, theme) is prepared for you here.

**Data source:** the project's Cloudflare Worker (no API key needed):
- Stations: `https://taiwan-weather-proxy.ii96391799.workers.dev/stations.csv`
- Observations: `https://taiwan-weather-proxy.ii96391799.workers.dev/observations.csv`

---

## 0. Prerequisites
- **Power BI Desktop** (free): https://aka.ms/pbidesktop (or Microsoft Store).
- A **personal Power BI account** (free) for "Publish to web". Use a personal
  Microsoft account — corporate tenants often disable public publishing.

---

## 1. Get the data
1. Open Power BI Desktop → **Home → Get data → Web**.
2. Paste the **stations** URL above → **OK** → in the preview click **Transform Data**.
3. In Power Query: confirm **Use First Row as Headers** is applied. Set column types:
   - `Lat`, `Lon`, `ElevationM` → **Decimal Number**
   - everything else → **Text** (StationID stays Text).
   - Rename the query to **Stations**. → **Close & Apply** later, or keep editing.
4. Back in Power Query: **New Source → Web**, paste the **observations** URL → **OK**.
5. Set column types on this query:
   - `TempC, HumidityPct, PressureHpa, WindMs, PrecipMm, SunshineHr` → **Decimal Number**
   - `Hour` → **Whole Number**
   - `DateTime` → **Date/Time**, `Date` → **Date**
   - `StationID, NameEN, WindDir` → **Text**.
   - Rename the query to **Observations**.
6. **Close & Apply**.

> If Chinese station names look garbled, the CSV already includes a UTF-8 BOM —
> just make sure the source is the **.csv** URL (not the root JSON).

---

## 2. Build the model (star schema)
1. Go to **Model view** (left rail).
2. Drag **Stations[StationID]** onto **Observations[StationID]** to create a relationship.
3. Confirm it is **One-to-many (1:*)**, **single** cross-filter direction
   (Stations is the "one" side). Double-click the relationship to verify.

---

## 3. Add the DAX measures
For each block below: **Modeling → New measure**, paste, press Enter. Put them on the
**Observations** table. (Copy them exactly.)

```DAX
Latest Time = MAX ( Observations[DateTime] )
```
```DAX
Current Temp =
CALCULATE ( AVERAGE ( Observations[TempC] ), Observations[DateTime] = [Latest Time] )
```
```DAX
Island Avg Temp = AVERAGEX ( VALUES ( Stations[StationID] ), [Current Temp] )
```
```DAX
Avg Temp 24h = AVERAGE ( Observations[TempC] )
```
```DAX
Max Temp 24h = MAX ( Observations[TempC] )
```
```DAX
Min Temp 24h = MIN ( Observations[TempC] )
```
```DAX
Current Humidity =
CALCULATE ( AVERAGE ( Observations[HumidityPct] ), Observations[DateTime] = [Latest Time] )
```
```DAX
Current Wind =
CALCULATE ( AVERAGE ( Observations[WindMs] ), Observations[DateTime] = [Latest Time] )
```
```DAX
Total Rain 24h = SUM ( Observations[PrecipMm] )
```
```DAX
Stations Reporting =
CALCULATE ( DISTINCTCOUNT ( Observations[StationID] ), NOT ( ISBLANK ( Observations[TempC] ) ) )
```
```DAX
Hottest Station =
VAR t = ADDCOLUMNS ( VALUES ( Stations[NameEN] ), "@T", [Current Temp] )
RETURN MAXX ( TOPN ( 1, t, [@T], DESC ), Stations[NameEN] & " · " & FORMAT ( [@T], "0.0" ) & "°C" )
```
```DAX
Coldest Station =
VAR t = ADDCOLUMNS ( VALUES ( Stations[NameEN] ), "@T", [Current Temp] )
RETURN MINX ( TOPN ( 1, t, [@T], ASC ), Stations[NameEN] & " · " & FORMAT ( [@T], "0.0" ) & "°C" )
```
```DAX
As Of = "Updated " & FORMAT ( [Latest Time], "yyyy-mm-dd HH:mm" )
```

Format `Current Temp`, `Avg/Max/Min Temp 24h`, `Island Avg Temp` as 1 decimal.

---

## 4. Apply the theme
**View → Themes → Browse for themes** → choose `theme/powerbi-theme.json` from this repo.

---

## 5. Build the "Overview" page
Rename Page 1 to **Overview**. Add these visuals (Visualizations pane → pick icon →
drag fields into the wells):

| Visual | Fields |
|--------|--------|
| **Card** ×4 | `Island Avg Temp` · `Hottest Station` · `Coldest Station` · `Stations Reporting` |
| **Map** (or **Azure Map**) | Latitude = `Stations[Lat]`, Longitude = `Stations[Lon]`, Bubble size = `Current Temp`, Legend/colour = `Current Temp` |
| **Clustered bar chart** | Y-axis = `Stations[NameEN]`, X-axis = `Current Temp`; sort **descending** by Current Temp |
| **Line chart** | X-axis = `Observations[Hour]`, Y-axis = `Avg Temp 24h` |
| **Slicer** | Field = `Stations[Region]` |
| **Table** | `Stations[NameEN]`, `Current Temp`, `Current Humidity`, `Current Wind`, `Total Rain 24h` |
| **Text box / Card** | `As Of` (shows the data timestamp) |

Tip: select the bar chart → **⋯ → Sort axis → Current Temp → Descending** so it reads
hottest→coldest like the website.

(Optional **Detail** page: a Station slicer + a line chart of `Avg Temp 24h` by `Hour`
filtered to one station, for a single-station drilldown.)

---

## 6. Publish to web (creates the iframe)
1. **Save** the file as `taiwan-weather.pbix`.
2. **Home → Publish → To "My workspace"** → sign in if prompted.
3. Open https://app.powerbi.com → your workspace → open the report.
4. **File → Embed report → Publish to web (public)** → **Create embed code** → confirm.
5. Copy the **iframe `src`** — it looks like:
   `https://app.powerbi.com/view?r=eyJrIjoi...`

> If **Publish to web** is greyed out, your tenant has disabled it. Switch to a
> personal Microsoft account and republish there.

---

## 7. Connect the embed to the site
Paste that `src` URL into **`js/powerbi-embed.js`**:

```js
export const EMBED_URL = "https://app.powerbi.com/view?r=PASTE_YOURS_HERE";
```

Then commit & push (or just tell the assistant the URL and it will wire it in):

```bash
git add js/powerbi-embed.js
git commit -m "feat: connect Power BI publish-to-web embed URL"
git push origin main
```

Within a minute GitHub Pages updates and `powerbi.html` shows the live report instead
of the "pending" placeholder.

---

## 8. Keep it fresh (scheduled refresh)
1. In Power BI Service → **My workspace** → the **dataset** → **⋯ → Settings**.
2. **Scheduled refresh → On**. Free accounts allow up to **8 refreshes/day**.
3. The Web/CSV source needs no gateway and no key, so refresh works out of the box.

> Note: a published-to-web embed reflects the latest refresh within **~1 hour**, so it
> won't be second-by-second live, but it stays current through the day.

---

## Troubleshooting
- **Garbled Chinese names** → ensure the query points at the `.csv` URL (BOM handles encoding).
- **Map shows nothing** → set `Lat`/`Lon` **Data category** (Modeling → Data category →
  Latitude / Longitude) and types to Decimal Number.
- **Hour line chart out of order** → set `Hour` to Whole Number and sort the axis ascending.
- **"Publish to web" disabled** → corporate tenant restriction; use a personal account.
