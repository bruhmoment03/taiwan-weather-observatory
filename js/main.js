// Boot: load data, pick a sensible default station, init every view.

import { loadAll, data } from "./data.js";
import { initStation } from "./state.js";
import { initCurrent } from "./views/current.js";
import { initMap } from "./views/map.js";
import { initTrends } from "./views/trends.js";
import { initCompare } from "./views/compare.js";

const DEFAULT_STATION = "466920"; // Taipei

(async function boot() {
  try {
    await loadAll();
    if (!data.latest.length) throw new Error("No station data available.");

    const start = data.byId[DEFAULT_STATION] ? DEFAULT_STATION : data.latest[0].id;
    initStation(start);

    initCurrent();
    initMap();
    initTrends();
    initCompare();
  } catch (err) {
    console.error(err);
    showError(err.message || "Could not load weather data.");
  }
})();

function showError(msg) {
  const el = document.getElementById("error-banner");
  el.textContent = `⚠ ${msg}  Try refreshing — the data may still be updating.`;
  el.hidden = false;
}
