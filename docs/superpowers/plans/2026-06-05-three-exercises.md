# 教學檔三練習 Implementation Plan（Plan 2 / 2）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **前置條件：** Plan 1（`2026-06-05-final-report.md`）的 Phase 1 已完成 — 網站骨架、`js/embeds.js`、`test/embeds.test.mjs`、`data/` 結構與 Pages 部署都已存在。
> **INTERACTIVE TASKS:** Tasks 3、4、5 需要使用者登入 app.powerbi.com，必須在主對話內聯執行；Tasks 1、2、6 為程式任務，可派發 subagent。

**Goal:** 完成教學檔三個練習的 Power BI 報表與網站接線：練習一（CWA 36 小時預報地圖、排程更新）、練習二（空品矩陣＋DAX 圖示）、練習三（銷售多頁分析＋Sunburst）。

**Architecture:** Worker 改抓 `F-C0032-001` 並以 `/forecast.csv` 輸出教學檔樞紐結果（即時、匿名、可排程更新）；練習二/三資料預處理後入庫由 Pages 供 URL；三份報表於 Power BI 服務瀏覽器建置，發佈至 Web 或截圖備援接進作品集網站。

**Tech Stack:** Cloudflare Workers（`node --test` 單元測試、wrangler deploy）、Python pandas/openpyxl、Power BI 服務。

**Spec:** `docs/superpowers/specs/2026-06-05-tutorial-remake-design.md`

**已驗證的資料事實：**
- `銷售業績.xlsx`：顧客資料 4,005 列（男 1,816／女 2,189，年齡 20–76）、訂單明細 5,626 列（12 欄，下單日期自 2016 起）；訂單顧客皆存在於顧客表；**1,062 位顧客無訂單**（必須補 stub 列，否則性別環圈比例與教學檔不符）。
- `aqx_p_08.csv`：UTF-8 BOM、1,000 資料列、monitormonth 全為 202603 — 原樣入庫即可。
- `worker/wrangler.toml`：`main = "src/index.js"`；部署指令 `npx wrangler deploy`（帳號快取於 `worker/.wrangler/`）。
- F-C0032-001 結構：`records.location[]`，每 location 有 `weatherElement[]`（elementName ∈ Wx/PoP/MinT/CI/MaxT），各含 `time[]`（startTime/endTime/parameter.parameterName），22 縣市 × 3 時段。

---

### Task 1: 練習三資料預處理（prepare_sales.py，TDD）

**Files:**
- Create: `scripts/prepare_sales.py`、`scripts/test_prepare_sales.py`
- Create（產物）: `data/sales.csv`、`data/aqx_p_08.csv`

- [ ] **Step 1: 寫失敗測試 `scripts/test_prepare_sales.py`**

```python
# -*- coding: utf-8 -*-
import sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

import pandas as pd
from prepare_sales import quarter, age_band, build_flat


class TestHelpers(unittest.TestCase):
    def test_quarter(self):
        self.assertEqual([quarter(m) for m in (1, 3, 4, 6, 7, 9, 10, 12)],
                         [1, 1, 2, 2, 3, 3, 4, 4])

    def test_age_band(self):
        self.assertEqual([age_band(a) for a in (20, 29, 30, 76)], [20, 20, 30, 70])

    def test_build_flat_adds_stub_rows(self):
        cust = pd.DataFrame({
            "顧客編號": ["A", "B", "C"], "姓名": ["甲", "乙", "丙"],
            "性別": ["Male", "Female", "Female"], "年齡": [25, 34, 41],
            "居住地區": ["臺北市"] * 3, "職業類別": ["金融業"] * 3,
        })
        orders = pd.DataFrame({
            "訂單編號": ["O1", "O2"], "顧客編號": ["A", "A"],
            "產品編號": ["P1", "P2"], "產品名稱": ["x", "y"], "產品類別": ["童裝", "配件"],
            "單價": [100, 200], "數量": [1, 2],
            "下單日期": pd.to_datetime(["2016-01-02", "2016-05-09"]),
            "小計": [100, 400], "利潤": [10, 40], "成本": [90, 360], "明年度預期目標值": [110, 440],
        })
        flat = build_flat(orders, cust)
        self.assertEqual(len(flat), 2 + 2)                      # 2 訂單列 + 2 無訂單顧客 stub
        self.assertEqual(flat["顧客編號"].nunique(), 3)
        stub = flat[flat["訂單編號"].isna()]
        self.assertEqual(sorted(stub["顧客編號"]), ["B", "C"])
        self.assertTrue(stub["小計"].isna().all())
        a_rows = flat[flat["顧客編號"] == "A"]
        self.assertEqual(set(a_rows["性別"]), {"Male"})          # 顧客屬性已併入訂單列
        self.assertEqual(list(a_rows["季"]), [1, 2])             # 1月→Q1、5月→Q2
        self.assertEqual(set(flat["年齡層"]), {20, 30, 40})


if __name__ == "__main__":
    unittest.main(verbosity=2)
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `$env:PYTHONIOENCODING="utf-8"; python D:\bi-final\scripts\test_prepare_sales.py`
Expected: FAIL（ModuleNotFoundError: prepare_sales）

- [ ] **Step 3: 寫 `scripts/prepare_sales.py`**

```python
# -*- coding: utf-8 -*-
"""銷售業績.xlsx → data/sales.csv（練習三用，扁平表＋無訂單顧客 stub 列）。

教學檔的環圈圖以「全部 4,005 位顧客」計性別比例；扁平訂單表只剩 2,943 位
有訂單的顧客，因此補上 1,062 位無訂單顧客的 stub 列（訂單欄空白），
報表一律以 DISTINCTCOUNT(顧客編號) 計顧客數即可逐數字重現教學檔。
另預先衍生教學檔 Power Query／群組步驟的產物：年、月、日、季、年齡層。
"""
from pathlib import Path

import pandas as pd

BASE = Path(__file__).resolve().parents[1]
XLSX = BASE / "彰師bi" / "銷售業績.xlsx"
OUT = BASE / "data" / "sales.csv"


def quarter(month: int) -> int:
    """月份 → 年中的季度（1–4）。"""
    return (month - 1) // 3 + 1


def age_band(age) -> int:
    """年齡 → 十歲一組的年齡層下限（教學檔「新增群組」bin=10 的等價結果）。"""
    return int(age) // 10 * 10


def build_flat(orders: pd.DataFrame, cust: pd.DataFrame) -> pd.DataFrame:
    flat = orders.merge(cust, on="顧客編號", how="left", validate="m:1")
    d = pd.to_datetime(flat["下單日期"])
    flat["年"], flat["月"], flat["日"] = d.dt.year, d.dt.month, d.dt.day
    flat["季"] = d.dt.month.map(quarter)

    stubs = cust[~cust["顧客編號"].isin(orders["顧客編號"])].copy()
    out = pd.concat([flat, stubs], ignore_index=True)
    out["年齡層"] = out["年齡"].map(age_band)
    return out


def main():
    cust = pd.read_excel(XLSX, sheet_name="顧客資料")
    orders = pd.read_excel(XLSX, sheet_name="訂單明細")
    flat = build_flat(orders, cust)

    # --- 驗證（spec §7）---
    assert len(flat) == 5626 + 1062, len(flat)
    assert flat["顧客編號"].nunique() == 4005
    g = flat.drop_duplicates("顧客編號")["性別"].value_counts()
    assert g["Male"] == 1816 and g["Female"] == 2189, g.to_dict()
    assert abs(flat["小計"].sum() - orders["小計"].sum()) < 1e-6
    assert flat["年齡層"].between(20, 70).all()
    assert flat[flat["訂單編號"].notna()]["性別"].notna().all()  # 訂單列都接到顧客屬性

    flat.to_csv(OUT, index=False, encoding="utf-8-sig")
    print(f"sales.csv: {len(flat)} rows, {len(flat.columns)} cols")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: 跑測試確認通過**

Run: `$env:PYTHONIOENCODING="utf-8"; python D:\bi-final\scripts\test_prepare_sales.py`
Expected: 3 tests PASS

- [ ] **Step 5: 執行主體＋複製空品檔**

```powershell
$env:PYTHONIOENCODING="utf-8"; python D:\bi-final\scripts\prepare_sales.py
Copy-Item "D:\bi-final\彰師bi\aqx_p_08.csv" D:\bi-final\data\aqx_p_08.csv
```
Expected: `sales.csv: 6688 rows, 22 cols`（訂單 12＋顧客屬性 5＋年/月/日/季＋年齡層）、`data/aqx_p_08.csv` 存在。

- [ ] **Step 6: Commit＋push＋驗證 Pages URL**

```powershell
git -C D:\bi-final add scripts/ data/sales.csv data/aqx_p_08.csv
git -C D:\bi-final commit -m "feat(exercises): sales flat table (with stub customers) + air-quality csv"
git -C D:\bi-final push origin main
```

部署後（重試至多 5 次、間隔 30s）：
Run: `curl.exe -s -o NUL -w "%{http_code}" https://bruhmoment03.github.io/taiwan-weather-observatory/data/sales.csv`
Expected: `200`（`data/aqx_p_08.csv` 同樣驗證）。

### Task 2: Worker 改造（/forecast.csv，TDD）

**Files:**
- Create: `worker/src/forecast.js`、`worker/test/forecast.test.mjs`、`worker/test/fixtures/forecast.json`
- Rewrite: `worker/src/index.js`
- Delete: `worker/src/csv.js`、`worker/test/csv.test.mjs`、`data/station_coords.json`

- [ ] **Step 1: 寫 fixture `worker/test/fixtures/forecast.json`**（仿 F-C0032-001 真實結構：2 縣市 × 2 時段；含一個帶逗號的 Wx 測 CSV 跳脫）

```json
{
  "success": "true",
  "records": {
    "datasetDescription": "三十六小時天氣預報",
    "location": [
      {
        "locationName": "臺北市",
        "weatherElement": [
          { "elementName": "Wx", "time": [
            { "startTime": "2026-06-05 12:00:00", "endTime": "2026-06-05 18:00:00", "parameter": { "parameterName": "多雲,偶陣雨", "parameterValue": "8" } },
            { "startTime": "2026-06-05 18:00:00", "endTime": "2026-06-06 06:00:00", "parameter": { "parameterName": "晴時多雲", "parameterValue": "2" } } ] },
          { "elementName": "PoP", "time": [
            { "startTime": "2026-06-05 12:00:00", "endTime": "2026-06-05 18:00:00", "parameter": { "parameterName": "30", "parameterUnit": "百分比" } },
            { "startTime": "2026-06-05 18:00:00", "endTime": "2026-06-06 06:00:00", "parameter": { "parameterName": "20", "parameterUnit": "百分比" } } ] },
          { "elementName": "MinT", "time": [
            { "startTime": "2026-06-05 12:00:00", "endTime": "2026-06-05 18:00:00", "parameter": { "parameterName": "25", "parameterUnit": "C" } },
            { "startTime": "2026-06-05 18:00:00", "endTime": "2026-06-06 06:00:00", "parameter": { "parameterName": "24", "parameterUnit": "C" } } ] },
          { "elementName": "CI", "time": [
            { "startTime": "2026-06-05 12:00:00", "endTime": "2026-06-05 18:00:00", "parameter": { "parameterName": "舒適" } },
            { "startTime": "2026-06-05 18:00:00", "endTime": "2026-06-06 06:00:00", "parameter": { "parameterName": "舒適" } } ] },
          { "elementName": "MaxT", "time": [
            { "startTime": "2026-06-05 12:00:00", "endTime": "2026-06-05 18:00:00", "parameter": { "parameterName": "33", "parameterUnit": "C" } },
            { "startTime": "2026-06-05 18:00:00", "endTime": "2026-06-06 06:00:00", "parameter": { "parameterName": "30", "parameterUnit": "C" } } ] }
        ]
      },
      {
        "locationName": "高雄市",
        "weatherElement": [
          { "elementName": "Wx", "time": [
            { "startTime": "2026-06-05 12:00:00", "endTime": "2026-06-05 18:00:00", "parameter": { "parameterName": "晴天", "parameterValue": "1" } },
            { "startTime": "2026-06-05 18:00:00", "endTime": "2026-06-06 06:00:00", "parameter": { "parameterName": "晴天", "parameterValue": "1" } } ] },
          { "elementName": "PoP", "time": [
            { "startTime": "2026-06-05 12:00:00", "endTime": "2026-06-05 18:00:00", "parameter": { "parameterName": "10" } },
            { "startTime": "2026-06-05 18:00:00", "endTime": "2026-06-06 06:00:00", "parameter": { "parameterName": "10" } } ] },
          { "elementName": "MinT", "time": [
            { "startTime": "2026-06-05 12:00:00", "endTime": "2026-06-05 18:00:00", "parameter": { "parameterName": "27" } },
            { "startTime": "2026-06-05 18:00:00", "endTime": "2026-06-06 06:00:00", "parameter": { "parameterName": "26" } } ] },
          { "elementName": "CI", "time": [
            { "startTime": "2026-06-05 12:00:00", "endTime": "2026-06-05 18:00:00", "parameter": { "parameterName": "悶熱" } },
            { "startTime": "2026-06-05 18:00:00", "endTime": "2026-06-06 06:00:00", "parameter": { "parameterName": "舒適" } } ] },
          { "elementName": "MaxT", "time": [
            { "startTime": "2026-06-05 12:00:00", "endTime": "2026-06-05 18:00:00", "parameter": { "parameterName": "34" } },
            { "startTime": "2026-06-05 18:00:00", "endTime": "2026-06-06 06:00:00", "parameter": { "parameterName": "31" } } ] }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2: 寫失敗測試 `worker/test/forecast.test.mjs`**

```js
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

test("樞紐值正確（臺北市第一時段）", () => {
  const lines = buildForecastCsv(raw).trim().split("\r\n");
  // Wx 含逗號 → 需被引號包住
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
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `node --test D:\bi-final\worker\test\forecast.test.mjs`
Expected: FAIL（Cannot find module ../src/forecast.js）

- [ ] **Step 4: 寫 `worker/src/forecast.js`**

```js
// F-C0032-001（一般天氣預報-今明36小時）→ 教學檔樞紐結果 CSV。
// 欄位：locationName,startTime,endTime,Wx,PoP,MinT,CI,MaxT（22 縣市 × 3 時段 = 66 列）

const ELEMENTS = ["Wx", "PoP", "MinT", "CI", "MaxT"];

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
}

export function buildForecastCsv(raw) {
  const rows = [["locationName", "startTime", "endTime", "Wx", "PoP", "MinT", "CI", "MaxT"]];
  for (const loc of raw.records.location) {
    const byEl = Object.fromEntries(loc.weatherElement.map((e) => [e.elementName, e.time]));
    const periods = byEl.Wx ?? loc.weatherElement[0]?.time ?? [];
    periods.forEach((t, i) => {
      const row = [loc.locationName, t.startTime, t.endTime];
      for (const el of ELEMENTS) {
        const slot = (byEl[el] ?? [])[i];
        row.push(slot ? slot.parameter.parameterName : "");
      }
      rows.push(row);
    });
  }
  return rows.map((r) => r.map(csvEscape).join(",")).join("\r\n") + "\r\n";
}
```

- [ ] **Step 5: 跑測試確認通過**

Run: `node --test D:\bi-final\worker\test\forecast.test.mjs`
Expected: 4 tests PASS

- [ ] **Step 6: 重寫 `worker/src/index.js`**（完整取代）

```js
// Cloudflare Worker: CWA 36 小時預報代理。
// 抓 F-C0032-001、樞紐成教學檔格式的 /forecast.csv（10 分鐘快取、CORS *）。
// CWA key 只存在 CWA_API_KEY secret，瀏覽器與 Power BI 都看不到。

import { buildForecastCsv } from "./forecast.js";

const DATASET = "F-C0032-001";
const CACHE_SECONDS = 600;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    const { pathname, origin } = new URL(request.url);

    if (pathname === "/") {
      return jsonResponse({
        service: "taiwan-weather-proxy",
        dataset: DATASET,
        routes: ["/forecast.csv"],
        source: "Central Weather Administration (CWA), Taiwan - Open Data",
      });
    }
    if (pathname !== "/forecast.csv") return jsonResponse({ error: "not found" }, 404);

    const key = env.CWA_API_KEY;
    if (!key) return jsonResponse({ error: "CWA_API_KEY secret is not configured." }, 500);

    const cache = caches.default;
    const cacheKey = new Request(origin + "/__forecast_csv", { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) return cached.clone();

    let raw;
    try {
      const res = await fetch(
        `https://opendata.cwa.gov.tw/api/v1/rest/datastore/${DATASET}?Authorization=${key}&format=JSON`,
        { cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true } }
      );
      if (!res.ok) return jsonResponse({ error: `CWA API returned HTTP ${res.status}` }, 502);
      raw = await res.json();
    } catch (e) {
      return jsonResponse({ error: `Upstream fetch failed: ${e.message}` }, 502);
    }
    if (String(raw.success).toLowerCase() !== "true") {
      return jsonResponse({ error: "CWA API reported success=false" }, 502);
    }

    const response = new Response(buildForecastCsv(raw), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
        ...CORS,
      },
    });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};
```

- [ ] **Step 7: 刪除舊檔**

```powershell
git -C D:\bi-final rm worker/src/csv.js worker/test/csv.test.mjs data/station_coords.json
```

- [ ] **Step 8: 全測試（worker＋site）**

Run: `node --test D:\bi-final\worker\test\ D:\bi-final\test\`
Expected: 全 PASS（舊 csv 測試已刪不再執行）。

- [ ] **Step 9: 部署**

Run: `Set-Location D:\bi-final\worker; npx wrangler deploy`
Expected: 部署成功，輸出 `taiwan-weather-proxy.ii96391799.workers.dev`。若要求登入，請使用者執行 `! cd worker; npx wrangler login`。

- [ ] **Step 10: 線上驗證**

Run: `curl.exe -s https://taiwan-weather-proxy.ii96391799.workers.dev/forecast.csv | Measure-Object -Line`
Expected: 67 行（表頭＋66 資料列）。再抽查第 2 行欄數＝8。

- [ ] **Step 11: Commit**

```powershell
git -C D:\bi-final add -A
git -C D:\bi-final commit -m "feat(worker): replace observation proxy with F-C0032-001 /forecast.csv"
git -C D:\bi-final push origin main
```

- [ ] **Step 12:** 提醒使用者（spec 待辦）：CWA key 曾外洩，建議到 CWA 平臺換發後執行 `npx wrangler secret put CWA_API_KEY`。

### Task 3: 練習一報表（INTERACTIVE）

**前置：** 使用者已登入 app.powerbi.com（Plan 1 Task 6 流程；發佈至 Web VERDICT 已知）。

- [ ] **Step 1:** 取得資料 → CSV → `https://taiwan-weather-proxy.ii96391799.workers.dev/forecast.csv` → 匿名 → 建立語意模型 `wx`。
- [ ] **Step 2:** 編輯資料模型：MinT、MaxT、PoP 設為整數。
- [ ] **Step 3:** 建立報表（依教學檔成品 image26）：
  - **地圖**：位置=locationName、圖例=PoP、泡泡大小=MaxT、工具提示=Wx；標題雙擊改「最高溫MaxT, 天氣狀況Wx 與 舒適度CI 依據 縣市LocationName 與 降雨機率PoP」（或更簡潔中文）。
  - 卡片×3：MaxT 最大值→「最高溫」、MinT 最小值→「最低溫」、PoP 平均→「平均降雨機率%」。
  - 交叉分析篩選器×2：startTime（清單）→「時間選擇」、locationName（磚塊式）。
  - 文字方塊：「資料來源：中央氣象署（CWA）開放資料平臺」。
  - 儲存為「練習一 台灣36小時天氣預報」。
- [ ] **Step 4: 排程更新**：我的工作區 → `wx` 語意模型 → 排程重新整理 → 資料來源認證「編輯認證」→ 匿名 → 登入；時區 (UTC+08:00) 台北 → 新增 8 個時間點（每 3 小時一個）→ 套用。手動「立即重新整理」一次，確認成功。
- [ ] **Step 5:** 發佈至 Web（可用時）→ embedUrl 填入 `js/embeds.js` 的 `ex1`；無論如何 1600×900 全頁截圖 → `assets/ex1.png`。
- [ ] **Step 6: Commit**

```powershell
git -C D:\bi-final add assets/ex1.png js/embeds.js
git -C D:\bi-final commit -m "feat(ex1): CWA 36hr forecast map dashboard wired"
```

### Task 4: 練習二報表（INTERACTIVE）

- [ ] **Step 1:** 取得資料 → CSV → `https://bruhmoment03.github.io/taiwan-weather-observatory/data/aqx_p_08.csv` → 匿名 → 模型 `aqx_p_08`；concentration 設為小數。
- [ ] **Step 2: 計算資料行 `item_display`**（模型編輯 → 新增資料行；教學檔 DAX 原文）：

```dax
item_display =
SWITCH(
    aqx_p_08[itemname],
    "非甲烷碳氫化合物", "非甲烷碳氫化合物(NMHC)",
    "一氧化氮", "一氧化氮(NO)",
    "小時風速值", "小時風速值",
    "一氧化碳", "一氧化碳(CO)",
    "二氧化硫", "二氧化硫(SO2)",
    "二氧化氮", "二氧化氮(NO2)",
    "臭氧", "臭氧 (O3)",
    "細懸浮微粒", "細懸浮微粒(PM2.5)",
    "懸浮微粒", "懸浮微粒(PM10)",
    "甲烷", "甲烷(CH4)",
    "相對濕度", "相對濕度(RH)",
    "風速", "風速(WS)",
    "溫度", "溫度(Temp)",
    "總碳氫化物", "總碳氫化物(THC)",
    "氮氧化物", "氮氧化物(NOx)",
    aqx_p_08[itemname]
)
```

**備援（spec §6）：** 服務不能建計算資料行 → 在 `scripts/` 加 10 行腳本把 `item_display` 欄預先算進 `data/aqx_p_08.csv`（同 SWITCH 對照），重新連結。

- [ ] **Step 3: 量值 `臭氧等級`**（教學檔 DAX 原文）：

```dax
臭氧等級 =
VAR CurrentItem = SELECTEDVALUE(aqx_p_08[itemname])
VAR O3 = AVERAGE(aqx_p_08[concentration])
RETURN
IF(
    CurrentItem = "臭氧",
    SWITCH(TRUE(), O3 < 30, 1, O3 < 40, 2, 3),
    BLANK()
)
```

- [ ] **Step 4:** 建報表（依教學檔成品 image57）：
  - **矩陣**：列=sitename、行=item_display、值=concentration 的平均；行小計/列小計關閉。
  - concentration 的平均 → 設定格式化的條件 → **圖示**：依「臭氧等級」量值，規則 =1 綠圓、=2 黃三角、=3 紅菱形。
  - 標題「2026年3月份台灣空氣品質監測」。
  - 交叉分析篩選器：itemname，標題改「空氣污染物」，設淺色背景。
  - 文字方塊：「資料來源：環境部環境資訊科技司 [202603] [空氣品質監測月值] https://data.moenv.gov.tw/dataset/detail/AQX_P_08」。
  - 儲存為「練習二 台灣空氣品質監測」。
- [ ] **Step 5:** 發佈至 Web（可用時）→ `ex2` embedUrl；截圖 → `assets/ex2.png`。
- [ ] **Step 6: Commit**（同 Task 3 Step 6 形式，訊息 `feat(ex2): air-quality matrix dashboard wired`）

### Task 5: 練習三報表（INTERACTIVE，三頁）

- [ ] **Step 1:** 取得資料 → CSV → `https://bruhmoment03.github.io/taiwan-weather-observatory/data/sales.csv` → 匿名 → 模型 `sales`；單價/數量/小計/利潤/成本/年/月/日/季/年齡/年齡層 設數值。
- [ ] **Step 2: 量值 `顧客數`**：

```dax
顧客數 = DISTINCTCOUNT(sales[顧客編號])
```

- [ ] **Step 3: 頁1「顧客分析」**：
  - 環圈圖：圖例=性別、值=顧客數 →（期望全量 45.3%／54.7%，與教學檔一致）。
  - 折線與群組直條圖：X=年齡層、資料行 y 軸=小計 的總和、線條 y 軸=顧客數。
- [ ] **Step 4: 頁2「訂單分析」**：
  - 緞帶圖：X=月、圖例=產品類別、Y=小計 的總和。
  - 堆疊直條圖：X=年（加入 季、月、日 成階層並展開）、Y=小計 的總和。
  - 卡片：小計 的總和 →「訂單金額」。
  - 視覺層級篩選（每個訂單視覺）：訂單編號 非空白（排除 stub 列）。
- [ ] **Step 5: 頁3「客群探索」**（依教學檔 image76/77）：
  - 交叉分析篩選器：居住地區。
  - 環圈：性別×顧客數；折線直條：年齡層（同頁1 複製）。
  - **Sunburst**：…→ 取得更多視覺效果 → AppSource 搜尋 "sunburst"（Microsoft 出品）→ 新增 → 資料系列=職業類別、資料行=性別、值=顧客數。
    **備援（spec §6）：** AppSource 被租用戶封鎖 → 改內建樹狀圖（類別=職業類別、詳細資料=性別、值=顧客數），並於 ex3.html 製作說明註記差異。
  - 卡片×2：顧客數；職業類別（第一個）→「前 職業類別」。
  - 矩陣：列=職業類別、行=性別、值=顧客數。
- [ ] **Step 6:** 儲存「練習三 顧客消費資料分析」；發佈至 Web（可用時）→ `ex3` embedUrl；三頁各截圖，首頁圖存 `assets/ex3.png`（其餘存 `assets/ex3-p2.png`、`assets/ex3-p3.png` 備用）。
- [ ] **Step 7: Commit**（訊息 `feat(ex3): sales analysis dashboard wired`）

### Task 6: 網站接線、製作說明、總驗收

**Files:**
- Modify: `ex1.html`、`ex2.html`、`ex3.html`（填充 howto）、`js/embeds.js`（最終 embed/連結確認）

- [ ] **Step 1: ex1.html 的 `<details class="howto">` 內容換成：**

```html
<summary>製作說明</summary>
<p>資料流程：CWA 開放資料 API（F-C0032-001）→ Cloudflare Worker 即時樞紐為
<a href="https://taiwan-weather-proxy.ii96391799.workers.dev/forecast.csv">forecast.csv</a>
（API 金鑰只存於 Worker secret）→ Power BI 以 CSV 連結匯入，排程每日自動更新（台北時區）。</p>
<p>教學檔原始作法為 Power BI 內以 Power Query 樞紐，公式如下（本作品改於 Worker 端完成、結果相同）：</p>
<pre>= Table.Group(Table.Pivot(已移除資料行, List.Distinct(已移除資料行[elementName]),
  "elementName","parameterName", List.First), {"locationName","startTime"},
  {{"Wx", each List.First(List.RemoveNulls([Wx])), type text},
   {"PoP", each List.First(List.RemoveNulls([PoP])), type text},
   {"MinT", each List.First(List.RemoveNulls([MinT])), type text},
   {"CI", each List.First(List.RemoveNulls([CI])), type text},
   {"MaxT", each List.First(List.RemoveNulls([MaxT])), type text}})</pre>
<p>視覺設定：地圖（位置=縣市、圖例=降雨機率 PoP、泡泡大小=最高溫 MaxT、工具提示=天氣狀況 Wx）＋
最高溫/最低溫/平均降雨機率卡片＋時間與縣市篩選器。</p>
```

- [ ] **Step 2: ex2.html howto 內容：**

```html
<summary>製作說明（含 DAX）</summary>
<p>矩陣：列=測站、行=item_display、值=濃度平均；臭氧欄位以 DAX 量值配條件格式化圖示
（&lt;30 綠、&lt;40 黃、其餘紅）。</p>
<pre>臭氧等級 =
VAR CurrentItem = SELECTEDVALUE(aqx_p_08[itemname])
VAR O3 = AVERAGE(aqx_p_08[concentration])
RETURN IF(CurrentItem = "臭氧",
  SWITCH(TRUE(), O3 &lt; 30, 1, O3 &lt; 40, 2, 3), BLANK())</pre>
<p>欄位顯示名稱由計算資料行 item_display（SWITCH 對照 15 種測項之英文縮寫）產生。</p>
```

- [ ] **Step 3: ex3.html howto 內容：**

```html
<summary>製作說明</summary>
<p>資料前處理（Python）：訂單明細 ⨝ 顧客資料攤平，並補入 1,062 位無訂單顧客之空白列，
使 DISTINCTCOUNT(顧客編號) 重現全體 4,005 位顧客的性別比例（男 45.3%）；
預先衍生 年/月/日/季 與 年齡層（10 歲一組，等同 Power BI「新增群組」bin=10）。</p>
<p>三頁：顧客分析（性別環圈、年齡層折線直條）、訂單分析（緞帶圖、日期階層堆疊直條、訂單金額卡片）、
客群探索（居住地篩選器、Sunburst 職業×性別、顧客數與前職業類別卡片、矩陣）。</p>
```

- [ ] **Step 4:** 跑 `node --test D:\bi-final\test\` → PASS；本機 `python -m http.server 8000` 逐頁目視驗證。
- [ ] **Step 5: Commit＋push**

```powershell
git -C D:\bi-final add -A
git -C D:\bi-final commit -m "feat(site): exercise pages wired with embeds and how-to notes"
git -C D:\bi-final push origin main
```

- [ ] **Step 6: 總驗收清單**
  - live 首頁/四子頁全部正常（`https://bruhmoment03.github.io/taiwan-weather-observatory/`）。
  - 練習一語意模型手動重新整理成功＋排程已設。
  - 三份報表截圖與教學檔成品圖並排比對（地圖泡泡/卡片、矩陣圖示、環圈比例 45.3%）。
  - `node --test`（site＋worker）與兩個 python 測試檔全 PASS。
  - 回報使用者：交件狀態＋CWA key 換發提醒。

---

## MILESTONE V4 紀錄（2026-06-06，練習二/三部分）

**比對基準：** `教學檔.docx` 成品圖（image57＝練習二矩陣、image76/77＝練習三頁3）。

| 項目 | 教學檔成品 | 本作品 | 判定 |
|---|---|---|---|
| 練習二 矩陣＋圖示 | 臭氧欄 綠圓/黃三角/紅菱形（image57） | 同規則渲染（如 大城 44→紅）；全 16 欄 8pt 入鏡 | ✅ |
| 練習二 標題/篩選器/文字方塊 | 「2026年3月份台灣空氣品質監測」＋空氣污染物＋資料來源 | 全部一致 | ✅ |
| 練習三 環圈 | 男 45.3%（全量 4,005 人） | 45.34% / 54.66% | ✅ 逐數字 |
| 練習三 矩陣 | 金融業和房地產 1062/775/1837（image77） | 1062/775/1837，Total 2189/1816/4005 | ✅ 逐數字 |
| 練習三 前 職業類別 卡片 | 住宿和餐飲業（image76） | 住宿和餐飲業 | ✅ |
| 練習三 Sunburst | AppSource Sunburst（Microsoft） | **改內建樹狀圖**（AppSource 對話框無法自動化完成 Add；spec §6 備援），ex3.html 已註記 | ⚠️ 替代（數值一致） |
| 練習一 | 地圖＋卡片＋篩選器 | **未建**——Worker 部署待 `npx wrangler login` | ⏳ BLOCKED |

**測試：** node embeds 7/7、worker forecast 4/4、python 10/10 全 PASS。
**報表連結：** 練習二 `67f2cda0-…`、練習三 `5c51405e-…`（已寫入 js/embeds.js）。
