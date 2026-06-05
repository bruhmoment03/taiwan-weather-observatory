// Cloudflare Worker: CWA 36 小時預報代理。
// 抓 F-C0032-001、樞紐成教學檔格式的 /forecast.csv（10 分鐘快取、CORS *）。
// CWA key 只存在 CWA_API_KEY secret，瀏覽器與 Power BI 都看不到。

import { buildForecastCsv } from "./forecast.js";

const DATASET = "F-C0032-001";
const CACHE_SECONDS = 600;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    const { pathname, origin } = new URL(request.url);

    if (pathname === "/") {
      return jsonResponse({
        service: "taiwan-weather-proxy",
        dataset: DATASET,
        routes: ["/forecast.csv"],
        source: "Central Weather Administration (CWA), Taiwan - Open Data",
      });
    }
    if (pathname !== "/forecast.csv") return jsonResponse({ error: "not found" }, 404);

    const key = env.CWA_API_KEY;
    if (!key) return jsonResponse({ error: "CWA_API_KEY secret is not configured." }, 500);

    const cache = caches.default;
    const cacheKey = new Request(origin + "/__forecast_csv", { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) return cached.clone();

    let raw;
    try {
      const res = await fetch(
        `https://opendata.cwa.gov.tw/api/v1/rest/datastore/${DATASET}?Authorization=${key}&format=JSON`,
        { cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true } }
      );
      if (!res.ok) return jsonResponse({ error: `CWA API returned HTTP ${res.status}` }, 502);
      raw = await res.json();
    } catch (e) {
      return jsonResponse({ error: `Upstream fetch failed: ${e.message}` }, 502);
    }
    if (String(raw.success).toLowerCase() !== "true") {
      return jsonResponse({ error: "CWA API reported success=false" }, 502);
    }

    const response = new Response(buildForecastCsv(raw), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
        ...CORS,
      },
    });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};
