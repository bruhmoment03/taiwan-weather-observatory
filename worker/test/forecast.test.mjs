import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildForecastCsv } from "../src/forecast.js";

const raw = JSON.parse(readFileSync(new URL("./fixtures/forecast.json", import.meta.url), "utf8"));

test("header 與列數（2 縣市 × 2 時段）", () => {
  const lines = buildForecastCsv(raw).trim().split("\r\n");
  assert.equal(lines[0], "locationName,startTime,endTime,Wx,PoP,MinT,CI,MaxT");
  assert.equal(lines.length, 1 + 4);
});

test("樞紐值正確（臺北市第一時段，Wx 含逗號需引號）", () => {
  const lines = buildForecastCsv(raw).trim().split("\r\n");
  assert.equal(lines[1], '臺北市,2026-06-05 12:00:00,2026-06-05 18:00:00,"多雲,偶陣雨",30,25,舒適,33');
});

test("高雄市第二時段", () => {
  const lines = buildForecastCsv(raw).trim().split("\r\n");
  assert.equal(lines[4], "高雄市,2026-06-05 18:00:00,2026-06-06 06:00:00,晴天,10,26,舒適,31");
});

test("缺元素時輸出空欄不丟例外", () => {
  const clone = structuredClone(raw);
  clone.records.location[0].weatherElement = clone.records.location[0].weatherElement.filter(e => e.elementName !== "CI");
  const lines = buildForecastCsv(clone).trim().split("\r\n");
  assert.equal(lines[1], '臺北市,2026-06-05 12:00:00,2026-06-05 18:00:00,"多雲,偶陣雨",30,25,,33');
});
