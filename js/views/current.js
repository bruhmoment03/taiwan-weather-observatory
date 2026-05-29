// Overview / hero: national summary, featured-station readout, station picker.

import { data, tempColor, fmt, fmtClock } from "../data.js";
import { getState, setStation, setMetric, subscribe } from "../state.js";
import { regionLabel } from "../i18n.js";
import { countUp } from "../anim.js";

const $ = (id) => document.getElementById(id);
let lastTemp = 0; // for the big-number count-up animation

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
  const tag = data.source === "live" ? "即時" : "快取";
  $("updated-text").textContent = `${tag} · ${m.last_updated_taipei || "—"}`;
  // Amber dot when serving committed fallback data instead of the live proxy.
  const dot = document.querySelector(".updated__dot");
  if (dot && data.source !== "live") dot.style.background = "#d99a2b";
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

  countUp($("nat-cold-val"), cold.temp, { from: 0, decimals: 1, suffix: "°" });
  countUp($("nat-hot-val"), hot.temp, { from: 0, decimals: 1, suffix: "°" });
  countUp($("nat-mean-val"), mean, { from: 0, decimals: 1, suffix: "°" });
  $("nat-cold-name").textContent = `${cold.name} · ${fmt(cold.elevation_m, 0)} m`;
  $("nat-hot-name").textContent = `${hot.name} · ${fmt(hot.elevation_m, 0)} m`;
  $("nat-count").textContent = `${reporting.length}／${data.latest.length} 個測站回報中`;

  const spread = (hot.temp - cold.temp).toFixed(1);
  $("hero-lede").innerHTML =
    `全島 ${data.latest.length} 個官方測站此刻氣溫相差達 <strong>${spread}°C</strong>` +
    `——從最涼的 <em>${cold.name}</em> 到最暖的 <em>${hot.name}</em>。`;
}

function buildStationSelect() {
  const sel = $("station-select");
  // Group by region for a tidy dropdown.
  const byRegion = {};
  for (const s of [...data.latest].sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"))) {
    (byRegion[s.region] ||= []).push(s);
  }
  const order = ["North", "Central", "South", "East", "Islands"];
  for (const region of order) {
    if (!byRegion[region]) continue;
    const og = document.createElement("optgroup");
    og.label = regionLabel(region);
    for (const s of byRegion[region]) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = `${s.name}（${s.name_en}）`;
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
  { key: "humidity", label: "濕度", unit: "%", digits: 0, trend: "humidity" },
  { key: "wind", label: "風速", unit: "m/s", digits: 1, note: (s) => s.wind_dir || "", trend: "wind" },
  { key: "pressure", label: "氣壓", unit: "hPa", digits: 1, trend: "pressure" },
  { key: "precip_24h_total", label: "雨量（24h）", unit: "mm", digits: 1, trend: "precip" },
  { key: "sunshine", label: "日照", unit: "hr", digits: 1 },
];

function renderFeatured() {
  const s = data.byId[getState().stationId];
  if (!s) return;

  const big = $("big-temp");
  big.style.color = tempColor(s.temp);
  countUp(big, s.temp, { from: lastTemp, decimals: 1 });
  lastTemp = s.temp == null ? 0 : s.temp;
  // brief pop on update
  big.classList.remove("bump");
  void big.offsetWidth; // restart animation
  big.classList.add("bump");

  const r = s.temp_24h || {};
  $("big-range").textContent =
    r.min == null ? "24 小時範圍 —" : `24 小時範圍 ${fmt(r.min)}° – ${fmt(r.max)}°  ·  平均 ${fmt(r.mean)}°`;

  $("feature-meta").innerHTML =
    `${s.county} · 海拔 ${fmt(s.elevation_m, 0)} m · 觀測於 ${fmtClock(s.obs_time)}`;

  $("metricgrid").innerHTML = METRIC_CARDS.map((c) => {
    const v = s[c.key];
    const note = c.note ? c.note(s) : "";
    const click = c.trend ? ` is-clickable" data-trend="${c.trend}` : "";
    return `<div class="metric${click}">
        <span class="metric__label">${c.label}</span>
        <span class="metric__value">${fmt(v, c.digits)}<span class="metric__unit"> ${c.unit}</span></span>
        ${note ? `<span class="metric__note">${note}</span>` : ""}
      </div>`;
  }).join("");

  // Clicking a metric card jumps to Trends with that metric selected.
  $("metricgrid").querySelectorAll(".metric.is-clickable").forEach((el) => {
    el.addEventListener("click", () => {
      setMetric(el.dataset.trend);
      document.getElementById("trends")?.scrollIntoView({ behavior: "smooth" });
    });
  });
}
