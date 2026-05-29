// Compare & rank: a current-temperature league table and a scatter that
// reveals altitude as the island's dominant control on temperature.

import { data, tempColor, fmt } from "../data.js";
import { setStation, subscribe } from "../state.js";

let rankChart, scatterChart, scatterX = "elevation_m";

const SCATTER_AXES = [
  { key: "elevation_m", label: "elevation", unit: "m" },
  { key: "humidity", label: "humidity", unit: "%" },
];

export function initCompare() {
  rankChart = echarts.init(document.getElementById("rank-chart"));
  scatterChart = echarts.init(document.getElementById("scatter-chart"));
  buildScatterToggle();
  renderRank();
  renderScatter();

  rankChart.on("click", (p) => p.data?.id && setStation(p.data.id));
  scatterChart.on("click", (p) => p.data?.id && setStation(p.data.id));

  window.addEventListener("resize", () => { rankChart.resize(); scatterChart.resize(); });
  subscribe((_s, change) => { if (change === "station") { renderRank(); renderScatter(); } });
}

function buildScatterToggle() {
  const wrap = document.getElementById("scatter-toggle");
  wrap.innerHTML = "";
  for (const a of SCATTER_AXES) {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = a.label[0].toUpperCase() + a.label.slice(1);
    b.dataset.axis = a.key;
    b.setAttribute("aria-pressed", String(a.key === scatterX));
    b.addEventListener("click", () => {
      scatterX = a.key;
      document.querySelectorAll("#scatter-toggle .chip").forEach((c) =>
        c.setAttribute("aria-pressed", String(c.dataset.axis === scatterX)));
      document.getElementById("scatter-x-label").textContent = a.label;
      renderScatter();
    });
    wrap.appendChild(b);
  }
}

function renderRank() {
  const rows = data.latest.filter((s) => s.temp != null).sort((a, b) => a.temp - b.temp);
  const names = rows.map((s) => s.name_en);
  const values = rows.map((s) => ({
    value: s.temp, id: s.id,
    itemStyle: { color: tempColor(s.temp), borderRadius: [0, 4, 4, 0] },
  }));

  rankChart.setOption({
    grid: { left: 92, right: 44, top: 8, bottom: 24 },
    tooltip: {
      trigger: "axis", axisPointer: { type: "shadow" },
      backgroundColor: "rgba(255,255,255,.96)", borderColor: "#e7e3da",
      textStyle: { color: "#1a1916", fontSize: 12 },
      formatter: (ps) => {
        const s = data.byId[ps[0].data.id];
        return `<b>${s.name_en}</b> · ${s.county}<br/>${fmt(s.temp)} °C · ${fmt(s.elevation_m, 0)} m`;
      },
    },
    xAxis: {
      type: "value", name: "°C", nameTextStyle: { color: "#8a877f" },
      axisLabel: { color: "#8a877f", fontSize: 11 },
      splitLine: { lineStyle: { color: "#f0ece3" } },
    },
    yAxis: {
      type: "category", data: names,
      axisLabel: { color: "#4a4843", fontSize: 11 },
      axisTick: { show: false }, axisLine: { lineStyle: { color: "#d9d4c9" } },
    },
    series: [{
      type: "bar", data: values, barWidth: "62%",
      label: { show: true, position: "right", formatter: (p) => `${p.value.toFixed(1)}°`,
        color: "#4a4843", fontSize: 11 },
    }],
  }, true);
}

function renderScatter() {
  const axis = SCATTER_AXES.find((a) => a.key === scatterX);
  const pts = data.latest
    .filter((s) => s.temp != null && s[scatterX] != null)
    .map((s) => ({
      value: [s[scatterX], s.temp], id: s.id,
      itemStyle: { color: tempColor(s.temp), borderColor: "#fff", borderWidth: 1 },
    }));

  scatterChart.setOption({
    grid: { left: 50, right: 24, top: 16, bottom: 46 },
    tooltip: {
      backgroundColor: "rgba(255,255,255,.96)", borderColor: "#e7e3da",
      textStyle: { color: "#1a1916", fontSize: 12 },
      formatter: (p) => {
        const s = data.byId[p.data.id];
        return `<b>${s.name_en}</b><br/>${fmt(s.temp)} °C · ${axis.label} ${fmt(s[scatterX], scatterX === "humidity" ? 0 : 0)} ${axis.unit}`;
      },
    },
    xAxis: {
      type: "value", name: `${axis.label} (${axis.unit})`, nameLocation: "middle", nameGap: 28,
      nameTextStyle: { color: "#8a877f", fontSize: 12 },
      axisLabel: { color: "#8a877f", fontSize: 11 },
      splitLine: { lineStyle: { color: "#f0ece3" } },
    },
    yAxis: {
      type: "value", name: "°C", scale: true, nameTextStyle: { color: "#8a877f" },
      axisLabel: { color: "#8a877f", fontSize: 11 },
      splitLine: { lineStyle: { color: "#f0ece3" } },
    },
    series: [{
      type: "scatter", data: pts, symbolSize: 13,
      emphasis: { scale: 1.4, itemStyle: { borderColor: "#1a1916", borderWidth: 1.5 } },
      label: {
        show: true, position: "right", formatter: (p) => data.byId[p.data.id].name_en,
        color: "#8a877f", fontSize: 9.5,
      },
    }],
  }, true);
}
