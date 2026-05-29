var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../data/station_coords.json
var station_coords_default = {
  _comment: "Curated reference for CWA staffed stations (C-B0024-001). lat/lon WGS84, elevation in metres. region: North/Central/South/East/Islands.",
  "466881": { lat: 25.0098, lon: 121.4456, elevation_m: 9.7, county: "New Taipei City", region: "North" },
  "466900": { lat: 25.1646, lon: 121.4489, elevation_m: 19, county: "New Taipei City", region: "North" },
  "466910": { lat: 25.1826, lon: 121.5297, elevation_m: 825.8, county: "Taipei City", region: "North" },
  "466920": { lat: 25.0376, lon: 121.5145, elevation_m: 6.3, county: "Taipei City", region: "North" },
  "466930": { lat: 25.162, lon: 121.5445, elevation_m: 607.1, county: "Taipei City", region: "North" },
  "466940": { lat: 25.1333, lon: 121.74, elevation_m: 26.7, county: "Keelung City", region: "North" },
  "466950": { lat: 25.6279, lon: 122.0797, elevation_m: 101.7, county: "Keelung City", region: "Islands" },
  "466990": { lat: 23.9751, lon: 121.6133, elevation_m: 16.1, county: "Hualien County", region: "East" },
  "467050": { lat: 24.9686, lon: 121.048, elevation_m: 25, county: "Taoyuan City", region: "North" },
  "467080": { lat: 24.7639, lon: 121.7569, elevation_m: 7.2, county: "Yilan County", region: "North" },
  "467110": { lat: 24.414, lon: 118.3588, elevation_m: 47.9, county: "Kinmen County", region: "Islands" },
  "467270": { lat: 23.86, lon: 120.58, elevation_m: 43, county: "Changhua County", region: "Central" },
  "467280": { lat: 24.62, lon: 120.78, elevation_m: 13, county: "Miaoli County", region: "Central" },
  "467290": { lat: 23.64, lon: 120.55, elevation_m: 65, county: "Yunlin County", region: "Central" },
  "467300": { lat: 23.2569, lon: 119.6664, elevation_m: 43, county: "Penghu County", region: "Islands" },
  "467350": { lat: 23.5655, lon: 119.563, elevation_m: 10.7, county: "Penghu County", region: "Islands" },
  "467410": { lat: 22.9933, lon: 120.2046, elevation_m: 40.8, county: "Tainan City", region: "South" },
  "467420": { lat: 23.04, lon: 120.23, elevation_m: 8, county: "Tainan City", region: "South" },
  "467441": { lat: 22.566, lon: 120.3157, elevation_m: 2.3, county: "Kaohsiung City", region: "South" },
  "467480": { lat: 23.4959, lon: 120.4327, elevation_m: 26.9, county: "Chiayi City", region: "South" },
  "467490": { lat: 24.1457, lon: 120.6841, elevation_m: 84, county: "Taichung City", region: "Central" },
  "467530": { lat: 23.5108, lon: 120.8132, elevation_m: 2413.4, county: "Chiayi County", region: "Central" },
  "467540": { lat: 22.3567, lon: 120.9023, elevation_m: 8.1, county: "Taitung County", region: "East" },
  "467550": { lat: 23.487, lon: 120.9595, elevation_m: 3844.6, county: "Nantou County", region: "Central" },
  "467571": { lat: 24.8279, lon: 121.0125, elevation_m: 26.9, county: "Hsinchu City", region: "North" },
  "467590": { lat: 22.0039, lon: 120.7463, elevation_m: 22.1, county: "Pingtung County", region: "South" },
  "467610": { lat: 23.0993, lon: 121.3653, elevation_m: 33.5, county: "Taitung County", region: "East" },
  "467620": { lat: 22.037, lon: 121.558, elevation_m: 324, county: "Taitung County", region: "Islands" },
  "467650": { lat: 23.8814, lon: 120.9083, elevation_m: 1017.5, county: "Nantou County", region: "Central" },
  "467660": { lat: 22.7522, lon: 121.1547, elevation_m: 9, county: "Taitung County", region: "East" },
  "467990": { lat: 26.169, lon: 119.9228, elevation_m: 98.6, county: "Lienchiang County", region: "Islands" }
};

// src/index.js
var coords = Object.fromEntries(
  Object.entries(station_coords_default).filter(([k]) => !k.startsWith("_"))
);
var DATASET = "C-B0024-001";
var CACHE_SECONDS = 600;
var MISSING = /* @__PURE__ */ new Set(["", "x", "x,x", "-99", "-99.0", "?", "none", "null"]);
var METRICS = {
  AirTemperature: ["temp", "Temperature", "\xB0C"],
  RelativeHumidity: ["humidity", "Relative Humidity", "%"],
  AirPressure: ["pressure", "Air Pressure", "hPa"],
  WindSpeed: ["wind", "Wind Speed", "m/s"],
  Precipitation: ["precip", "Precipitation", "mm"],
  SunshineDuration: ["sunshine", "Sunshine", "hr"]
};
var r1 = /* @__PURE__ */ __name((x) => Math.round(x * 10) / 10, "r1");
function toFloat(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (MISSING.has(s.toLowerCase())) return null;
  const f = parseFloat(s);
  if (Number.isNaN(f) || f <= -90) return null;
  return f;
}
__name(toFloat, "toFloat");
function cleanWindDir(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (MISSING.has(s.toLowerCase())) return null;
  const parts = s.split(",").map((p) => p.trim());
  if (parts.length === 2) {
    const en = parts[1];
    return MISSING.has(en.toLowerCase()) ? null : en;
  }
  return MISSING.has(s.toLowerCase()) ? null : s;
}
__name(cleanWindDir, "cleanWindDir");
function stats(values) {
  const nums = values.filter((v) => v != null);
  if (!nums.length) return { min: null, max: null, mean: null };
  return {
    min: r1(Math.min(...nums)),
    max: r1(Math.max(...nums)),
    mean: r1(nums.reduce((a, b) => a + b, 0) / nums.length)
  };
}
__name(stats, "stats");
function build(raw) {
  const locations = raw.records.location;
  const latest = [];
  const timeseries = {};
  let windowStart = null, windowEnd = null;
  for (const loc of locations) {
    const st = loc.station;
    const sid = st.StationID;
    const obs = [...loc.stationObsTimes.stationObsTime].sort(
      (a, b) => a.DateTime < b.DateTime ? -1 : 1
    );
    const times = obs.map((o) => o.DateTime);
    if (times.length) {
      windowStart = windowStart && windowStart < times[0] ? windowStart : times[0];
      windowEnd = windowEnd && windowEnd > times[times.length - 1] ? windowEnd : times[times.length - 1];
    }
    const series = { time: times };
    for (const [apiKey, [outKey]] of Object.entries(METRICS)) {
      series[outKey] = obs.map((o) => toFloat(o.weatherElements?.[apiKey]));
    }
    timeseries[sid] = series;
    const geo = coords[sid] || {};
    const last = obs.length ? obs[obs.length - 1] : { weatherElements: {}, DateTime: null };
    const we = last.weatherElements || {};
    latest.push({
      id: sid,
      name: st.StationName,
      name_en: st.StationNameEN,
      attribute: st.StationAttribute ?? null,
      lat: geo.lat ?? null,
      lon: geo.lon ?? null,
      elevation_m: geo.elevation_m ?? null,
      county: geo.county ?? null,
      region: geo.region ?? null,
      obs_time: last.DateTime,
      temp: toFloat(we.AirTemperature),
      humidity: toFloat(we.RelativeHumidity),
      pressure: toFloat(we.AirPressure),
      wind: toFloat(we.WindSpeed),
      wind_dir: cleanWindDir(we.WindDirection),
      precip: toFloat(we.Precipitation),
      sunshine: toFloat(we.SunshineDuration),
      temp_24h: stats(series.temp),
      humidity_24h: stats(series.humidity),
      precip_24h_total: r1(series.precip.reduce((a, b) => a + (b ?? 0), 0))
    });
  }
  latest.sort((a, b) => a.id < b.id ? -1 : 1);
  const now = /* @__PURE__ */ new Date();
  const taipei = new Date(now.getTime() + 8 * 3600 * 1e3).toISOString().slice(0, 16).replace("T", " ") + " (UTC+8)";
  const meta = {
    dataset: DATASET,
    source: "Central Weather Administration (CWA), Taiwan - Open Data",
    source_url: "https://opendata.cwa.gov.tw/",
    mode: "live",
    last_updated_utc: now.toISOString().slice(0, 19) + "Z",
    last_updated_taipei: taipei,
    window_start: windowStart,
    window_end: windowEnd,
    station_count: latest.length,
    metrics: Object.fromEntries(
      Object.values(METRICS).map(([ok, label, unit]) => [ok, { label, unit }])
    )
  };
  return { meta, latest, timeseries };
}
__name(build, "build");
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
function jsonResponse(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS, ...extra }
  });
}
__name(jsonResponse, "jsonResponse");
var index_default = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const key = env.CWA_API_KEY;
    if (!key) return jsonResponse({ error: "CWA_API_KEY secret is not configured." }, 500);
    const cache = caches.default;
    const cacheKey = new Request(new URL(request.url).origin + "/__cwa_payload", { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
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
    const payload = build(raw);
    const response = jsonResponse(payload, 200, {
      "Cache-Control": `public, max-age=${CACHE_SECONDS}`
    });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
