// Data loading, the temperature colour scale, and shared formatters.

import { LIVE_URL } from "./config.js";

const DATA = { meta: null, latest: [], byId: {}, timeseries: {}, source: "cached" };

export async function loadAll() {
  let payload = null;

  // 1. Prefer the live Worker proxy (fresh data, key kept server-side).
  if (LIVE_URL) {
    try {
      payload = await fetchJSON(`${LIVE_URL}?t=${Math.floor(Date.now() / 60000)}`);
      DATA.source = "live";
    } catch (e) {
      console.warn("Live source unavailable, falling back to committed data:", e.message);
    }
  }

  // 2. Fall back to the JSON committed in the repo so the site never goes blank.
  if (!payload) {
    const bust = `?v=${Math.floor(Date.now() / 60000)}`;
    const [meta, latest, timeseries] = await Promise.all([
      fetchJSON(`./data/meta.json${bust}`),
      fetchJSON(`./data/latest.json${bust}`),
      fetchJSON(`./data/timeseries.json${bust}`),
    ]);
    payload = { meta, latest, timeseries };
    DATA.source = "cached";
  }

  DATA.meta = payload.meta;
  DATA.latest = payload.latest;
  DATA.timeseries = payload.timeseries;
  DATA.byId = Object.fromEntries(payload.latest.map((s) => [s.id, s]));
  return DATA;
}

async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load ${url} (HTTP ${res.status})`);
  return res.json();
}

export const data = DATA;

/* ---------- Temperature colour scale (ColorBrewer RdBu, reversed) ---------- */
// Domain tuned for Taiwan: high peaks near freezing, lowlands ~38°C.
const STOPS = [
  [5,  [33, 102, 172]],   // #2166ac deep blue
  [12, [67, 147, 195]],   // #4393c3
  [18, [146, 197, 222]],  // #92c5de
  [23, [247, 232, 211]],  // warm paper neutral
  [28, [244, 165, 130]],  // #f4a582
  [33, [214, 96, 77]],    // #d6604d
  [38, [178, 24, 43]],    // #b2182b deep red
];

export function tempColor(t) {
  if (t == null || Number.isNaN(t)) return "#c9c5ba"; // neutral grey for missing
  if (t <= STOPS[0][0]) return rgb(STOPS[0][1]);
  if (t >= STOPS[STOPS.length - 1][0]) return rgb(STOPS[STOPS.length - 1][1]);
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [t0, c0] = STOPS[i];
    const [t1, c1] = STOPS[i + 1];
    if (t >= t0 && t <= t1) {
      const f = (t - t0) / (t1 - t0);
      return rgb([
        Math.round(c0[0] + (c1[0] - c0[0]) * f),
        Math.round(c0[1] + (c1[1] - c0[1]) * f),
        Math.round(c0[2] + (c1[2] - c0[2]) * f),
      ]);
    }
  }
  return "#c9c5ba";
}
const rgb = ([r, g, b]) => `rgb(${r}, ${g}, ${b})`;

/* ---------- Formatters ---------- */
export function fmt(value, digits = 1, dash = "—") {
  return value == null || Number.isNaN(value) ? dash : value.toFixed(digits);
}

export function fmtTimeLabel(iso) {
  // "2026-05-27T13:00:00+08:00" -> "13:00"
  const m = /T(\d{2}:\d{2})/.exec(iso || "");
  return m ? m[1] : iso || "";
}

export function fmtClock(iso) {
  // -> "週三 13:00"
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fmtTimeLabel(iso);
  const day = d.toLocaleDateString("zh-TW", { weekday: "short", timeZone: "Asia/Taipei" });
  const t = fmtTimeLabel(iso);
  return `${day} ${t}`;
}
