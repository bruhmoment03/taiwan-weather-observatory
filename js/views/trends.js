// 24-hour trend chart for the featured station, against the national spread.

import { data, tempColor, fmtTimeLabel } from "../data.js";
import { getState, setMetric, subscribe } from "../state.js";

const METRICS = [
  { key: "temp", label: "Temperature", unit: "°C" },
  { key: "humidity", label: "Humidity", unit: "%" },
  { key: "pressure", label: "Pressure", unit: "hPa" },
  { key: "wind", label: "Wind", unit: "m/s" },
  { key: "precip", label: "Precipitation", unit: "mm" },
];

let chart;

export function initTrends() {
  chart = echarts.init(document.getElementById("trend-chart"), null, { renderer: "canvas" });
  buildToggle();
  render();
  window.addEventListener("resize", () => chart.resize());
  subscribe((_s, change) => {
    if (change === "station" || change === "metric") {
      if (change === "metric") syncToggle();
      render();
    }
  });
}

function buildToggle() {
  const wrap = document.getElementById("metric-toggle");
  wrap.innerHTML = "";
  for (const m of METRICS) {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = m.label;
    b.dataset.metric = m.key;
    b.setAttribute("aria-pressed", String(m.key === getState().metric));
    b.addEventListener("click", () => setMetric(m.key));
    wrap.appendChild(b);
  }
}
function syncToggle() {
  document.querySelectorAll("#metric-toggle .chip").forEach((c) =>
    c.setAttribute("aria-pressed", String(c.dataset.metric === getState().metric)));
}

function envelope(key, n) {
  // Per-hour min / max / mean across all stations (ignoring nulls).
  const min = [], max = [], avg = [];
  for (let i = 0; i < n; i++) {
    const vals = [];
    for (const id in data.timeseries) {
      const v = data.timeseries[id][key]?.[i];
      if (v != null) vals.push(v);
    }
    if (vals.length) {
      min.push(Math.round(Math.min(...vals) * 10) / 10);
      max.push(Math.round(Math.max(...vals) * 10) / 10);
      avg.push(Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10);
    } else { min.push(null); max.push(null); avg.push(null); }
  }
  return { min, max, avg };
}

function render() {
  const st = getState();
  const station = data.byId[st.stationId];
  const series = data.timeseries[st.stationId];
  const metric = METRICS.find((m) => m.key === st.metric) || METRICS[0];
  if (!station || !series) return;

  document.getElementById("trend-station-name").textContent = station.name_en;
  document.querySelector("#trends .section__sub").innerHTML =
    `Hourly <strong>${metric.label.toLowerCase()}</strong> for <strong>${station.name_en}</strong>. ` +
    `The shaded band is the national spread (min–max across all stations); the dashed line is the island average.`;

  const times = series.time.map(fmtTimeLabel);
  const n = times.length;
  const env = envelope(metric.key, n);
  const stationVals = series[metric.key];
  const isTemp = metric.key === "temp";
  const lineColor = isTemp ? (tempColor(station.temp) || "#c0392b") : "#c0392b";
  const range = env.max.map((hi, i) => (hi == null || env.min[i] == null ? null : Math.round((hi - env.min[i]) * 10) / 10));

  chart.setOption({
    grid: { left: 52, right: 22, top: 24, bottom: 38 },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(255,255,255,.96)",
      borderColor: "#e7e3da",
      textStyle: { color: "#1a1916", fontFamily: "Inter, sans-serif", fontSize: 12 },
      formatter: (ps) => {
        const i = ps[0].dataIndex;
        const v = (x) => (x == null ? "—" : x);
        return `<b>${times[i]}</b><br/>` +
          `<span style="color:${lineColor}">●</span> ${station.name_en}: <b>${v(stationVals[i])} ${metric.unit}</b><br/>` +
          `Island avg: ${v(env.avg[i])} ${metric.unit}<br/>` +
          `National range: ${v(env.min[i])} – ${v(env.max[i])} ${metric.unit}`;
      },
    },
    xAxis: {
      type: "category", data: times, boundaryGap: false,
      axisLine: { lineStyle: { color: "#d9d4c9" } },
      axisLabel: { color: "#8a877f", fontSize: 11, interval: 2 },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value", scale: true,
      name: metric.unit, nameTextStyle: { color: "#8a877f", fontSize: 11, align: "right" },
      splitLine: { lineStyle: { color: "#f0ece3" } },
      axisLabel: { color: "#8a877f", fontSize: 11 },
    },
    series: [
      { name: "_min", type: "line", data: env.min, stack: "band", symbol: "none",
        lineStyle: { opacity: 0 }, silent: true },
      { name: "_range", type: "line", data: range, stack: "band", symbol: "none",
        lineStyle: { opacity: 0 }, areaStyle: { color: "rgba(120,130,150,.12)" }, silent: true },
      { name: "Island average", type: "line", data: env.avg, symbol: "none", smooth: true,
        lineStyle: { color: "#8a877f", width: 1.4, type: "dashed" }, z: 3 },
      { name: station.name_en, type: "line", data: stationVals, smooth: true, symbol: "circle",
        symbolSize: 5, showSymbol: false,
        lineStyle: { color: lineColor, width: 3 }, itemStyle: { color: lineColor },
        areaStyle: isTemp ? { color: hexFade(lineColor) } : undefined, z: 5,
        connectNulls: true },
    ],
  }, true);
}

// Soft vertical fade under the temperature line.
function hexFade(color) {
  return {
    type: "linear", x: 0, y: 0, x2: 0, y2: 1,
    colorStops: [
      { offset: 0, color: color.replace("rgb", "rgba").replace(")", ", 0.16)") },
      { offset: 1, color: color.replace("rgb", "rgba").replace(")", ", 0.01)") },
    ],
  };
}
