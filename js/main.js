// Boot: load data, pick a sensible default station, init every view.

import { loadAll, data } from "./data.js";
import { initStation } from "./state.js";
import { initCurrent } from "./views/current.js";
import { initMap } from "./views/map.js";
import { initTrends } from "./views/trends.js";
import { initCompare } from "./views/compare.js";
import { initAnimations } from "./anim.js";

const DEFAULT_STATION = "466920"; // Taipei

(async function boot() {
  try {
    await loadAll();
    if (!data.latest.length) throw new Error("目前沒有可用的測站資料。");

    const start = data.byId[DEFAULT_STATION] ? DEFAULT_STATION : data.latest[0].id;
    initStation(start);

    initCurrent();
    initMap();
    initTrends();
    initCompare();
    initAnimations();
  } catch (err) {
    console.error(err);
    showError(err.message || "無法載入氣象資料。");
  }
})();

function showError(msg) {
  const el = document.getElementById("error-banner");
  el.textContent = `⚠ ${msg} 請重新整理——資料可能正在更新。`;
  el.hidden = false;
}
