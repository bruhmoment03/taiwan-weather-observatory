// Overview / hero: national summary, featured-station readout, station picker.

import { data, tempColor, fmt, fmtClock } from "../data.js";
import { getState, setStation, subscribe } from "../state.js";

const $ = (id) => document.getElementById(id);

export function initCurrent() {
  renderMeta();
  renderNational();
  buildStationSelect();
  buildLegendTicks();
  renderFeatured();

  $("station-select").addEventListener("change", (e) => setStation(e.target.value));
  subscribe((_s, change) => {
    if (change === "station") {
      renderFeatured();
      $("station-select").value = getState().stationId;
    }
  });
}

function renderMeta() {
  const m = data.meta;
  $("updated-text").textContent = m.last_updated_taipei || "—";
  const start = (m.window_start || "").slice(5, 16).replace("T", " ");
  const end = (m.window_end || "").slice(5, 16).replace("T", " ");
  $("window-label").textContent = start && end ? `${start} → ${end} (UTC+8)` : "—";
}

function renderNational() {
  const reporting = data.latest.filter((s) => s.temp != null);
  if (!reporting.length) return;
  const hot = reporting.reduce((a, b) => (b.temp > a.temp ? b : a));
  const cold = reporting.reduce((a, b) => (b.temp < a.temp ? b : a));
  const mean = reporting.reduce((sum, s) => sum + s.temp, 0) / reporting.length;

  $("nat-cold-val").textContent = `${fmt(cold.temp)}°`;
  $("nat-cold-name").textContent = `${cold.name_en} · ${fmt(cold.elevation_m, 0)} m`;
  $("nat-hot-val").textContent = `${fmt(hot.temp)}°`;
  $("nat-hot-name").textContent = `${hot.name_en} · ${fmt(hot.elevation_m, 0)} m`;
  $("nat-mean-val").textContent = `${fmt(mean)}°`;
  $("nat-count").textContent = `${reporting.length} of ${data.latest.length} stations reporting`;

  const spread = (hot.temp - cold.temp).toFixed(1);
  $("hero-lede").innerHTML =
    `Across ${data.latest.length} official stations the mercury spans <strong>${spread}°C</strong> ` +
    `right now — from the cool of <em>${cold.name_en}</em> to the warmth of <em>${hot.name_en}</em>.`;
}

function buildStationSelect() {
  const sel = $("station-select");
  // Group by region for a tidy dropdown.
  const byRegion = {};
  for (const s of [...data.latest].sort((a, b) => a.name_en.localeCompare(b.name_en))) {
    (byRegion[s.region] ||= []).push(s);
  }
  const order = ["North", "Central", "South", "East", "Islands"];
  for (const region of order) {
    if (!byRegion[region]) continue;
    const og = document.createElement("optgroup");
    og.label = region;
    for (const s of byRegion[region]) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = `${s.name_en} (${s.name})`;
      og.appendChild(opt);
    }
    sel.appendChild(og);
  }
  sel.value = getState().stationId;
}

function buildLegendTicks() {
  $("legend-ticks").innerHTML = ["10°", "20°", "30°"].map((t) => `<span>${t}</span>`).join("");
}

const METRIC_CARDS = [
  { key: "humidity", label: "Humidity", unit: "%", digits: 0 },
  { key: "wind", label: "Wind", unit: "m/s", digits: 1, note: (s) => s.wind_dir || "" },
  { key: "pressure", label: "Pressure", unit: "hPa", digits: 1 },
  { key: "precip_24h_total", label: "Rain (24h)", unit: "mm", digits: 1 },
  { key: "sunshine", label: "Sunshine", unit: "hr", digits: 1 },
];

function renderFeatured() {
  const s = data.byId[getState().stationId];
  if (!s) return;

  const big = $("big-temp");
  big.textContent = s.temp == null ? "—" : fmt(s.temp);
  big.style.color = tempColor(s.temp);

  const r = s.temp_24h || {};
  $("big-range").textContent =
    r.min == null ? "24-hour range —" : `24-hour range ${fmt(r.min)}° – ${fmt(r.max)}°  ·  avg ${fmt(r.mean)}°`;

  $("feature-meta").innerHTML =
    `${s.county} · ${fmt(s.elevation_m, 0)} m elevation · observed ${fmtClock(s.obs_time)}`;

  $("metricgrid").innerHTML = METRIC_CARDS.map((c) => {
    const v = s[c.key];
    const note = c.note ? c.note(s) : "";
    return `<div class="metric">
        <span class="metric__label">${c.label}</span>
        <span class="metric__value">${fmt(v, c.digits)}<span class="metric__unit"> ${c.unit}</span></span>
        ${note ? `<span class="metric__note">${note}</span>` : ""}
      </div>`;
  }).join("");
}
