// Live data source — the Cloudflare Worker proxy that holds the CWA key.
// Set after the worker is deployed (npx wrangler deploy prints the URL).
// If empty or unreachable, the site falls back to the committed data/*.json.
export const LIVE_URL = ""; // e.g. "https://taiwan-weather-proxy.<subdomain>.workers.dev"
