// CSV builders for the Power BI data endpoints. Pure functions (testable in node).
const BOM = "﻿";

export function toCsv(headers, rows) {
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const out = [headers.join(",")];
  for (const r of rows) out.push(r.map(esc).join(","));
  return out.join("\n");
}

export function buildCsvStations(payload) {
  const headers = ["StationID", "NameEN", "NameZH", "Region", "County", "Lat", "Lon", "ElevationM"];
  const rows = payload.latest.map((s) => [
    s.id, s.name_en, s.name, s.region, s.county, s.lat, s.lon, s.elevation_m,
  ]);
  return BOM + toCsv(headers, rows);
}

export function buildCsvObservations(payload) {
  const headers = ["StationID", "NameEN", "DateTime", "Date", "Hour",
    "TempC", "HumidityPct", "PressureHpa", "WindMs", "WindDir", "PrecipMm", "SunshineHr"];
  const nameById = Object.fromEntries(payload.latest.map((s) => [s.id, s.name_en]));
  // wind_dir is per-station latest only (not per hour), so observations leave it blank.
  const rows = [];
  for (const [sid, ts] of Object.entries(payload.timeseries)) {
    const name = nameById[sid] ?? "";
    for (let i = 0; i < ts.time.length; i++) {
      const dt = ts.time[i];
      rows.push([
        sid, name, dt, dt.slice(0, 10), Number(dt.slice(11, 13)),
        ts.temp[i], ts.humidity[i], ts.pressure[i], ts.wind[i], null, ts.precip[i], ts.sunshine[i],
      ]);
    }
  }
  return BOM + toCsv(headers, rows);
}
