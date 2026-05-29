// Live data source — the Cloudflare Worker proxy that holds the CWA key.
// Set after the worker is deployed (npx wrangler deploy prints the URL).
// If empty or unreachable, the site falls back to the committed data/*.json.
export const LIVE_URL = "https://taiwan-weather-proxy.ii96391799.workers.dev";
