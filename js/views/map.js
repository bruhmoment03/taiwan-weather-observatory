// Interactive station map. Markers coloured by current temperature.

import { data, tempColor, fmt, fmtClock } from "../data.js";
import { getState, setStation, setRegions, subscribe } from "../state.js";
import { regionLabel } from "../i18n.js";

const REGIONS = ["North", "Central", "South", "East", "Islands"];
let map, markers = {}, activeRegions = new Set(REGIONS);

export function initMap() {
  map = L.map("leaflet", { scrollWheelZoom: false, attributionControl: true })
    .setView([23.7, 121.0], 7);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd", maxZoom: 18,
  }).addTo(map);

  for (const s of data.latest) {
    if (s.lat == null) continue;
    const m = L.circleMarker([s.lat, s.lon], markerStyle(s, false))
      .addTo(map)
      .bindTooltip(s.name, { direction: "top", offset: [0, -4] })
      .bindPopup(popupHTML(s), { className: "station-pop", closeButton: false });
    m.on("click", () => setStation(s.id));
    markers[s.id] = m;
  }

  buildRegionFilters();
  highlight(getState().stationId);

  subscribe((_s, change) => {
    if (change === "station") highlight(getState().stationId);
    if (change === "regions") applyRegionVisibility();
  });

  // Leaflet needs a nudge once its container has real dimensions.
  setTimeout(() => map.invalidateSize(), 200);
}

function markerStyle(s, active) {
  return {
    radius: active ? 11 : 7,
    fillColor: tempColor(s.temp),
    color: active ? "#1a1916" : "#ffffff",
    weight: active ? 2.5 : 1.5,
    opacity: 1,
    fillOpacity: 0.92,
  };
}

function popupHTML(s) {
  return `<div class="station-pop">
      <b>${s.name}</b> <span class="pop-row">${s.name_en}</span><br/>
      <span class="pop-t" style="color:${tempColor(s.temp)}">${fmt(s.temp)}°C</span>
      <div class="pop-row">濕度 ${fmt(s.humidity, 0)}% · 風速 ${fmt(s.wind)} m/s</div>
      <div class="pop-row">海拔 ${fmt(s.elevation_m, 0)} m · ${s.county}</div>
      <div class="pop-row">${fmtClock(s.obs_time)}</div>
    </div>`;
}

function highlight(activeId) {
  for (const [id, m] of Object.entries(markers)) {
    m.setStyle(markerStyle(data.byId[id], id === activeId));
    if (id === activeId) m.bringToFront();
  }
}

function buildRegionFilters() {
  const wrap = document.getElementById("region-filters");
  const make = (label, region) => {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = label;
    b.setAttribute("aria-pressed", "true");
    b.dataset.region = region || "ALL";
    b.addEventListener("click", () => toggleRegion(region, b));
    return b;
  };
  wrap.appendChild(make("全部", null));
  for (const r of REGIONS) wrap.appendChild(make(regionLabel(r), r));
  syncChips();
}

function toggleRegion(region, _btn) {
  if (region === null) {
    activeRegions = new Set(REGIONS); // "All" resets
  } else if (activeRegions.has(region) && activeRegions.size === REGIONS.length) {
    activeRegions = new Set([region]); // first click isolates
  } else if (activeRegions.has(region)) {
    activeRegions.delete(region);
    if (activeRegions.size === 0) activeRegions = new Set(REGIONS);
  } else {
    activeRegions.add(region);
  }
  setRegions(activeRegions.size === REGIONS.length ? null : new Set(activeRegions));
  applyRegionVisibility();
  syncChips();
}

function applyRegionVisibility() {
  for (const s of data.latest) {
    const m = markers[s.id];
    if (!m) continue;
    if (activeRegions.has(s.region)) m.addTo(map);
    else map.removeLayer(m);
  }
}

function syncChips() {
  const all = activeRegions.size === REGIONS.length;
  document.querySelectorAll("#region-filters .chip").forEach((c) => {
    const r = c.dataset.region;
    const on = r === "ALL" ? all : activeRegions.has(r);
    c.setAttribute("aria-pressed", String(on));
  });
}
