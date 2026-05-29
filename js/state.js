// Tiny shared store so the hero, map, trends and compare views stay in sync.

const state = {
  stationId: null,   // currently featured station
  metric: "temp",    // metric shown in the trends chart
  regions: null,     // Set of active regions for the map, or null = all
};

const listeners = new Set();

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(change) {
  for (const fn of listeners) fn(state, change);
}

export function setStation(id) {
  if (!id || id === state.stationId) return;
  state.stationId = id;
  emit("station");
}

export function setMetric(metric) {
  if (!metric || metric === state.metric) return;
  state.metric = metric;
  emit("metric");
}

export function setRegions(regionsSetOrNull) {
  state.regions = regionsSetOrNull;
  emit("regions");
}

// Initialise without firing listeners (used once at boot).
export function initStation(id) {
  state.stationId = id;
}
