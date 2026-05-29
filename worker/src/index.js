// Cloudflare Worker: live CWA proxy.
// Fetches dataset C-B0024-001, shapes it exactly like scripts/fetch_data.py,
// caches the result, and serves { meta, latest, timeseries } with open CORS.
// The CWA key lives only in the CWA_API_KEY secret — never in the browser.

import coordsRaw from "../../data/station_coords.json";

const coords = Object.fromEntries(
  Object.entries(coordsRaw).filter(([k]) => !k.startsWith("_"))
);

const DATASET = "C-B0024-001";
const CACHE_SECONDS = 600; // CWA updates hourly; 10 min keeps it fresh & gentle

// Lowercased "no reading" sentinels.
const MISSING = new Set(["", "x", "x,x", "-99", "-99.0", "?", "none", "null"]);

// API key -> [outKey, label, unit]
const METRICS = {
  AirTemperature:   ["temp",     "Temperature",       "°C"],
  RelativeHumidity: ["humidity", "Relative Humidity", "%"],
  AirPressure:      ["pressure", "Air Pressure",      "hPa"],
  WindSpeed:        ["wind",     "Wind Speed",        "m/s"],
  Precipitation:    ["precip",   "Precipitation",     "mm"],
  SunshineDuration: ["sunshine", "Sunshine",          "hr"],
};

const r1 = (x) => Math.round(x * 10) / 10;

function toFloat(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (MISSING.has(s.toLowerCase())) return null;
  const f = parseFloat(s);
  if (Number.isNaN(f) || f <= -90) return null;
  return f;
}

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

function stats(values) {
  const nums = values.filter((v) => v != null);
  if (!nums.length) return { min: null, max: null, mean: null };
  return {
    min: r1(Math.min(...nums)),
    max: r1(Math.max(...nums)),
    mean: r1(nums.reduce((a, b) => a + b, 0) / nums.length),
  };
}

function build(raw) {
  const locations = raw.records.location;
  const latest = [];
  const timeseries = {};
  let windowStart = null, windowEnd = null;

  for (const loc of locations) {
    const st = loc.station;
    const sid = st.StationID;
    const obs = [...loc.stationObsTimes.stationObsTime].sort((a, b) =>
      a.DateTime < b.DateTime ? -1 : 1
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
      precip_24h_total: r1(series.precip.reduce((a, b) => a + (b ?? 0), 0)),
    });
  }

  latest.sort((a, b) => (a.id < b.id ? -1 : 1));

  const now = new Date();
  const taipei = new Date(now.getTime() + 8 * 3600 * 1000)
    .toISOString().slice(0, 16).replace("T", " ") + " (UTC+8)";

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
    ),
  };

  return { meta, latest, timeseries };
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS, ...extra },
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    const key = env.CWA_API_KEY;
    if (!key) return jsonResponse({ error: "CWA_API_KEY secret is not configured." }, 500);

    // Edge cache keyed by a stable URL so all visitors share one cached payload.
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
      "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
    });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};
