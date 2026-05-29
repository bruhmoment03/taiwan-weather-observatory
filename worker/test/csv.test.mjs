import assert from "node:assert";
import { toCsv, buildCsvStations, buildCsvObservations } from "../src/csv.js";

// toCsv quoting
const csv = toCsv(["A", "B"], [["x,y", 'he said "hi"'], [null, 1]]);
const lines = csv.split("\n");
assert.strictEqual(lines[0], "A,B");
assert.strictEqual(lines[1], '"x,y","he said ""hi"""');
assert.strictEqual(lines[2], ",1"); // null -> empty cell

// fixture mimicking build() output
const payload = {
  latest: [{ id: "466920", name: "臺北", name_en: "Taipei", region: "North",
             county: "Taipei City", lat: 25.0376, lon: 121.5145, elevation_m: 6.3 }],
  timeseries: { "466920": {
    time: ["2026-05-27T01:00:00+08:00", "2026-05-27T02:00:00+08:00"],
    temp: [26.5, null], humidity: [77, 80], pressure: [1002.3, 1002.8],
    wind: [1.4, 0.2], precip: [0.0, 0.0], sunshine: [0.0, 0.0] } },
};
const sCsv = buildCsvStations(payload);
assert.ok(sCsv.startsWith("﻿"), "stations csv has BOM");
assert.strictEqual(sCsv.replace("﻿", "").split("\n").length, 2); // header + 1
assert.ok(sCsv.includes("466920") && sCsv.includes("臺北"));

const oCsv = buildCsvObservations(payload);
const oLines = oCsv.replace("﻿", "").split("\n");
assert.strictEqual(oLines.length, 3); // header + 2 hours
assert.ok(oLines[0].startsWith("StationID,NameEN,DateTime,Date,Hour,TempC"));
assert.ok(oLines[1].includes("2026-05-27") && oLines[1].includes(",1,")); // Hour col
console.log("csv.test OK");
