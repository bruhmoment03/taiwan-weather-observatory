import { test } from "node:test";
import assert from "node:assert/strict";
import { embedHtml, videoHtml, EMBEDS } from "../js/embeds.js";

test("embedUrl 有值 → iframe", () => {
  const html = embedHtml({ title: "t", embedUrl: "https://app.powerbi.com/view?r=abc", screenshot: "assets/a.png", reportLink: "" });
  assert.match(html, /<iframe/);
  assert.match(html, /view\?r=abc/);
});

test("embedUrl 空 → 截圖備援＋連結", () => {
  const html = embedHtml({ title: "t", embedUrl: "", screenshot: "assets/x.png", reportLink: "https://r.example" });
  assert.match(html, /<img src="assets\/x.png"/);
  assert.match(html, /https:\/\/r.example/);
  assert.doesNotMatch(html, /<iframe/);
});

test("reportLink 空 → 不渲染連結段", () => {
  const html = embedHtml({ title: "t", embedUrl: "", screenshot: "assets/x.png", reportLink: "" });
  assert.doesNotMatch(html, /<a /);
});

test("videoHtml", () => {
  assert.match(videoHtml("abc123"), /youtube\.com\/embed\/abc123/);
  assert.match(videoHtml(""), /待補/);
});

test("EMBEDS 七個項目齊全且截圖路徑正確", () => {
  for (const key of ["report1", "report2", "report3", "report4", "ex1", "ex2", "ex3"]) {
    assert.ok(EMBEDS[key], `missing ${key}`);
    assert.ok(EMBEDS[key].screenshot.startsWith("assets/"));
  }
});
