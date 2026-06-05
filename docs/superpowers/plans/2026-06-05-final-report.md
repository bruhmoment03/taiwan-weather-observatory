# 期末報告＋共用網站基礎 Implementation Plan（Plan 1 / 2）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **INTERACTIVE TASKS:** Tasks 6, 7, 11 drive app.powerbi.com through Chrome automation and need the user logged in. They MUST run inline in the main session (not subagent-dispatched). Code tasks (1–5, 8–10) are subagent-safe.

**Goal:** 交付「商業智慧」期末報告全套 — 4 份教育大數據 Power BI 儀表板、python-docx 生成的 Word 報告、影片逐字稿，外加兩案共用的 GitHub Pages 作品集網站骨架。

**Architecture:** 原始 tab 分隔 CSV（本機）→ `scripts/prepare_edu.py` 清理彙總 → `data/edu/*.csv`（入庫，Pages 公開 URL）→ Power BI 服務以 CSV 連結建 4 個模型/報表（瀏覽器自動化）→ 截圖進 Word、發佈至 Web 進網站。網站為純靜態四＋一頁，`js/embeds.js` 為唯一嵌入設定點。

**Tech Stack:** Python 3.12（pandas、openpyxl、python-docx、unittest）、vanilla ESM + node:test、Power BI 服務（app.powerbi.com）、GitHub Pages。

**Specs:** `docs/superpowers/specs/2026-06-05-final-report-design.md`（本案）＋ `2026-06-05-tutorial-remake-design.md` §2（repo 重做範圍）。

**已實測的資料事實（程式碼依據，勿再猜測）：**
- 11 個原始 CSV 都是 **tab 分隔**、UTF-8。列數：user_data 313、dp001_prac 6,624、dp001_review 4,567、dp001_review_plus 118,390、dp001_exam 1,763、dp002_exam 41,864、dp003_word 2,140、dp003_math 1,365、dp004_interaction 15,392、dp004_video 6,086、dp004_webpage 23,642。
- `binary_res` 格式 `'1@XX@0@XX@'`（**字面** `@XX@` 分隔、有尾隨分隔符）。
- dp002/dp004 `result_duration` 為 ISO8601（`PT0M21S`、`PT5S`，可能含 H）；`result_success` 為布林 True/False。
- dp002/dp004 時間戳 `2024-09-05T15:34:49.000+08:00`（含時區）；dp001 為 naive `YYYY-MM-DD HH:MM:SS`；dp003_word `YYYY-MM-DD HH:MM`；dp003_math 用 `last_modified`（Unix ms, UTC）。
- `dp001_review_plus` 有文件未載明的 `turbo` 欄（播放速度 0.5/1.0/1.5）；其 `timestamp` 是影片內秒數，牆鐘時間在 `view_time`。
- 所有 log 的 `user_sn` 都在 user_data 內（inner/left join 皆安全）；`dp001_review` 無 end<start 列。
- 成績缺失：國 120、數 45、英 112。
- Pages URL 底座：`https://bruhmoment03.github.io/taiwan-weather-observatory/`。

---

## Phase 1：Repo 重置＋網站骨架＋資料上線

### Task 1: Repo 重置與 .gitignore

**Files:**
- Delete: `js/`（全部）、`css/styles.css`、`data/meta.json`、`data/latest.json`、`data/timeseries.json`、`scripts/fetch_data.py`、`.github/`、`powerbi.html`、`POWERBI.md`、`theme/`、`test/embed.test.mjs`、`.env.example`
- Keep: `data/station_coords.json`（worker 仍 import，Plan 2 Task 2 一併移除）、`worker/`、`docs/`
- Modify: `.gitignore`、`README.md`

- [ ] **Step 1: 確認 .github 只含舊 workflow 再刪**

Run: `Get-ChildItem D:\bi-final\.github -Recurse -File | Select-Object FullName`
Expected: 只有 `workflows\update-data.yml`（若有其他檔案，停下回報）。

- [ ] **Step 2: 刪除舊前端與舊管線**

```powershell
git -C D:\bi-final rm -r js css scripts/fetch_data.py .github powerbi.html POWERBI.md theme test .env.example data/meta.json data/latest.json data/timeseries.json
```

注意：`git rm` 不會碰未追蹤檔案；若任一路徑回報 not found，逐一確認後跳過該路徑。

- [ ] **Step 3: 更新 .gitignore**

在現有 `.gitignore` 末尾追加（Edit 工具，保留原內容）：

```gitignore
# course materials (licensed for teaching use; never commit)
彰師bi/
台灣天氣資料.xlsx
~$*

# generated final report (contains personal info)
report/
```

- [ ] **Step 4: 重寫 README.md**（完整覆蓋）

```markdown
# 商業智慧 Power BI 作品集

彰師大「商業智慧」課程成果，GitHub Pages 託管：

- **期末報告**（`report.html`）：教育大數據 2025 微學程開放資料 — 313 位國小學生
  × 4 個學習平臺行為紀錄的四主題分析（使用概況、行為×成績、影片行為、難點）。
- **練習一**（`ex1.html`）：CWA 今明 36 小時天氣預報地圖儀表板（Cloudflare Worker
  `/forecast.csv` 即時供應，排程更新）。
- **練習二**（`ex2.html`）：環境部空氣品質監測月值矩陣＋DAX 圖示。
- **練習三**（`ex3.html`）：銷售業績顧客消費分析（環圈/緞帶/堆疊/Sunburst）。

## 結構

| 路徑 | 用途 |
|------|------|
| `index.html` + `ex*.html` + `report.html` | 靜態頁面 |
| `js/embeds.js` | 唯一嵌入設定點（Power BI iframe／截圖備援） |
| `data/edu/*.csv` | 期末報告分析就緒表（彙總後衍生資料） |
| `data/*.csv` | 練習二/三資料（Power BI 以 URL 連結） |
| `worker/` | Cloudflare Worker：CWA F-C0032-001 → `/forecast.csv` |
| `scripts/` | 前處理腳本（pandas）與單元測試 |

## 資料出處

- 教育大數據分析計畫辦公室「2025 教育大數據微學程教學用開放資料」——教學用途，
  本 repo 僅含彙總後衍生表，分析結果不得用於實務現象詮釋。
- 中央氣象署（CWA）開放資料平臺、環境部環境資訊科技司。

測試：`node --test test/` 與 `python scripts/test_prepare_edu.py`。
```

- [ ] **Step 5: Commit**

```powershell
git -C D:\bi-final add -A
git -C D:\bi-final commit -m "chore: reset repo for portfolio remake (remove Observatory front-end)"
```

### Task 2: 網站骨架（embeds.js TDD → 五頁＋CSS）

**Files:**
- Create: `js/embeds.js`、`test/embeds.test.mjs`、`css/site.css`、`index.html`、`report.html`、`ex1.html`、`ex2.html`、`ex3.html`、`assets/.gitkeep`

- [ ] **Step 1: 寫失敗測試 `test/embeds.test.mjs`**

```js
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test D:\bi-final\test\`
Expected: FAIL（Cannot find module ... js/embeds.js）

- [ ] **Step 3: 寫 `js/embeds.js`**

```js
// 唯一設定點：所有 Power BI 嵌入與影片設定。
// embedUrl 留空 → 顯示截圖備援（screenshot）＋報表連結（reportLink，可空）。
export const EMBEDS = {
  report1: { title: "報表1 學習平臺使用概況",   embedUrl: "", screenshot: "assets/report1.png", reportLink: "" },
  report2: { title: "報表2 學習行為與成績關聯", embedUrl: "", screenshot: "assets/report2.png", reportLink: "" },
  report3: { title: "報表3 影片學習行為解析",   embedUrl: "", screenshot: "assets/report3.png", reportLink: "" },
  report4: { title: "報表4 科目與能力難點",     embedUrl: "", screenshot: "assets/report4.png", reportLink: "" },
  ex1: { title: "練習一 台灣今明36小時天氣預報", embedUrl: "", screenshot: "assets/ex1.png", reportLink: "" },
  ex2: { title: "練習二 台灣空氣品質監測",       embedUrl: "", screenshot: "assets/ex2.png", reportLink: "" },
  ex3: { title: "練習三 顧客消費資料分析",       embedUrl: "", screenshot: "assets/ex3.png", reportLink: "" },
};

export const VIDEO_ID = ""; // YouTube 影片 ID，錄好後填入（Task 11）

export function embedHtml(cfg) {
  if (cfg.embedUrl) {
    return `<iframe title="${cfg.title}" src="${cfg.embedUrl}" allowfullscreen="true"></iframe>`;
  }
  const link = cfg.reportLink
    ? `<p class="embed-note"><a href="${cfg.reportLink}" target="_blank" rel="noopener">在 Power BI 開啟互動報表 ↗</a></p>`
    : "";
  return `<img src="${cfg.screenshot}" alt="${cfg.title} 截圖">${link}` +
    `<p class="embed-note">目前顯示報表截圖（互動嵌入待「發佈至 Web」權限開放）。</p>`;
}

export function videoHtml(id) {
  if (!id) return `<p class="embed-note">解說影片連結待補。</p>`;
  return `<iframe src="https://www.youtube.com/embed/${id}" title="解說影片" allowfullscreen></iframe>`;
}

// 瀏覽器端掛載（node 測試環境無 document，安全跳過）
if (typeof document !== "undefined") {
  document.querySelectorAll("[data-embed]").forEach((el) => {
    const cfg = EMBEDS[el.dataset.embed];
    if (cfg) { el.innerHTML = embedHtml(cfg); el.classList.add("embed-slot"); }
  });
  document.querySelectorAll("[data-video]").forEach((el) => {
    el.innerHTML = videoHtml(VIDEO_ID);
    el.classList.add("video-slot");
  });
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test D:\bi-final\test\`
Expected: 5 tests PASS

- [ ] **Step 5: 寫 `css/site.css`**（教學檔範本風格放大版）

```css
:root { --header:#1f2937; --bg:#f4f6f9; --card:#fff; --text:#1f2937; --muted:#666; --accent:#2563eb; }
* { box-sizing: border-box; }
body { font-family:"Noto Sans TC","Microsoft JhengHei",Arial,sans-serif; margin:0; background:var(--bg); color:var(--text); }
.header { background:var(--header); color:#fff; padding:28px 20px; text-align:center; }
.header h1 { margin:0 0 6px; font-size:1.6rem; }
.header p { margin:0; color:#cbd5e1; font-size:.95rem; }
.container { max-width:1100px; margin:0 auto; padding:20px; }
.cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:16px; }
.card { background:var(--card); border-radius:10px; box-shadow:0 0 10px rgba(0,0,0,.08); padding:18px; display:flex; flex-direction:column; gap:8px; }
.card h2 { margin:0; font-size:1.1rem; }
.card p { margin:0; color:var(--muted); font-size:.9rem; flex:1; }
.card a.btn { display:inline-block; background:var(--accent); color:#fff; padding:8px 14px; border-radius:8px; text-decoration:none; text-align:center; }
.card.featured { grid-column:1/-1; border:2px solid var(--accent); }
.embed-slot iframe { width:100%; height:850px; border:none; border-radius:10px; box-shadow:0 0 10px rgba(0,0,0,.2); background:#fff; }
.embed-slot img { width:100%; border-radius:10px; box-shadow:0 0 10px rgba(0,0,0,.2); }
.embed-note { margin:8px 0 0; color:var(--muted); font-size:.85rem; }
.video-slot iframe { width:100%; aspect-ratio:16/9; border:none; border-radius:10px; box-shadow:0 0 10px rgba(0,0,0,.2); }
details.howto { background:var(--card); border-radius:10px; box-shadow:0 0 10px rgba(0,0,0,.08); padding:14px 18px; margin-top:20px; }
details.howto summary { cursor:pointer; font-weight:700; }
details.howto pre { background:#0f172a; color:#e2e8f0; padding:12px; border-radius:8px; overflow:auto; font-size:.85rem; }
.footer { margin:24px 0; color:var(--muted); font-size:14px; text-align:center; }
.backlink { display:inline-block; margin-bottom:12px; color:var(--accent); text-decoration:none; }
h2.sec { margin-top:28px; }
```

- [ ] **Step 6: 寫 `index.html`**

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>商業智慧 Power BI 作品集</title>
  <link rel="stylesheet" href="css/site.css">
</head>
<body>
<div class="header">
  <h1>商業智慧 Power BI 作品集</h1>
  <p>期末報告與教學檔三練習｜Power BI ＋ 開放資料</p>
</div>
<div class="container">
  <div class="cards">
    <div class="card featured">
      <h2>期末報告：國小學習平臺行為與學業成績分析</h2>
      <p>313 位學生 × 4 個學習平臺的一學期行為紀錄。四大主題：使用概況、學習行為×成績、影片學習行為、科目與能力難點。附完整報告與解說影片。</p>
      <a class="btn" href="report.html">進入期末報告</a>
    </div>
    <div class="card">
      <h2>練習一：台灣 36 小時天氣預報</h2>
      <p>CWA 開放資料 API 即時供應的地圖泡泡儀表板，排程自動更新。</p>
      <a class="btn" href="ex1.html">進入</a>
    </div>
    <div class="card">
      <h2>練習二：台灣空氣品質監測</h2>
      <p>環境部監測月值：矩陣＋臭氧等級紅黃綠圖示（DAX 條件格式）。</p>
      <a class="btn" href="ex2.html">進入</a>
    </div>
    <div class="card">
      <h2>練習三：顧客消費資料分析</h2>
      <p>銷售業績資料：環圈、緞帶、堆疊直條與 Sunburst 客群探索。</p>
      <a class="btn" href="ex3.html">進入</a>
    </div>
  </div>
  <div class="footer">以 Power BI 製作｜GitHub Pages 託管</div>
</div>
<script type="module" src="js/embeds.js"></script>
</body>
</html>
```

- [ ] **Step 7: 寫 `report.html`**

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>期末報告｜國小學習平臺行為與學業成績分析</title>
  <link rel="stylesheet" href="css/site.css">
</head>
<body>
<div class="header">
  <h1>期末報告：國小學習平臺行為與學業成績分析</h1>
  <p>教育大數據 2025 微學程教學用開放資料｜Power BI</p>
</div>
<div class="container">
  <a class="backlink" href="index.html">← 回作品集</a>
  <h2 class="sec">解說影片</h2>
  <div data-video></div>
  <h2 class="sec">報表1 學習平臺使用概況</h2>
  <div data-embed="report1"></div>
  <h2 class="sec">報表2 學習行為與成績關聯</h2>
  <div data-embed="report2"></div>
  <h2 class="sec">報表3 影片學習行為解析</h2>
  <div data-embed="report3"></div>
  <h2 class="sec">報表4 科目與能力難點</h2>
  <div data-embed="report4"></div>
  <details class="howto">
    <summary>資料來源與前處理摘要</summary>
    <p>資料來源：教育大數據分析計畫辦公室「2025 教育大數據微學程教學用開放資料」（教學用途，
    分析結果不得用於實務現象詮釋，使用須註明出處）。本站僅公開彙總後之衍生資料表；
    前處理（欄位重新命名、缺失值處理、時間標準化、作答串解析）詳見期末報告文件。</p>
  </details>
  <div class="footer">資料來源：教育大數據分析計畫辦公室（教學用開放資料）</div>
</div>
<script type="module" src="js/embeds.js"></script>
</body>
</html>
```

- [ ] **Step 8: 寫 `ex1.html`、`ex2.html`、`ex3.html`**（同一模板，三檔各自代入下表值；howto 內容由 Plan 2 Task 6 填充）

| 檔 | `{TITLE}` | `{SUB}` | `{KEY}` | `{SOURCE}` |
|----|-----------|---------|---------|------------|
| ex1.html | 練習一：台灣今明 36 小時天氣預報 | CWA 開放資料 F-C0032-001｜Power BI 地圖 | ex1 | 資料來源：中央氣象署（CWA）開放資料平臺 |
| ex2.html | 練習二：台灣空氣品質監測 | 環境部 空氣品質監測月值 AQX_P_08｜Power BI 矩陣 | ex2 | 資料來源：環境部環境資訊科技司 [202603] [空氣品質監測月值] |
| ex3.html | 練習三：顧客消費資料分析 | 銷售業績範例資料｜Power BI 多頁儀表板 | ex3 | 資料：課程提供之銷售業績範例檔 |

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{TITLE}</title>
  <link rel="stylesheet" href="css/site.css">
</head>
<body>
<div class="header">
  <h1>{TITLE}</h1>
  <p>{SUB}</p>
</div>
<div class="container">
  <a class="backlink" href="index.html">← 回作品集</a>
  <div data-embed="{KEY}"></div>
  <details class="howto">
    <summary>製作說明</summary>
    <p>本練習建置中，說明將於完成時補上。</p>
  </details>
  <div class="footer">{SOURCE}</div>
</div>
<script type="module" src="js/embeds.js"></script>
</body>
</html>
```

- [ ] **Step 9: 建 `assets/.gitkeep`（空檔）並本機驗證**

```powershell
New-Item -ItemType File D:\bi-final\assets\.gitkeep
```

Run: `python -m http.server 8000 --directory D:\bi-final`（背景），瀏覽器開 `http://localhost:8000/` 與 `report.html`。
Expected: 首頁四卡片正常；report.html 四個區塊顯示「截圖」備援文案（圖檔 404 屬預期——截圖 Task 7 才產生）、影片顯示「待補」。驗完停掉 server。

- [ ] **Step 10: Commit**

```powershell
git -C D:\bi-final add -A
git -C D:\bi-final commit -m "feat(site): portfolio skeleton (5 pages, embeds config, tests)"
```

### Task 3: prepare_edu 輔助函式（TDD）

**Files:**
- Create: `scripts/prepare_edu.py`（先只放輔助函式）、`scripts/test_prepare_edu.py`

- [ ] **Step 1: 寫失敗測試 `scripts/test_prepare_edu.py`**

```python
# -*- coding: utf-8 -*-
import sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

import pandas as pd
from prepare_edu import parse_iso_duration, parse_binary_res, time_cols


class TestHelpers(unittest.TestCase):
    def test_iso_duration(self):
        self.assertEqual(parse_iso_duration("PT0M21S"), 21)
        self.assertEqual(parse_iso_duration("PT5S"), 5)
        self.assertEqual(parse_iso_duration("PT1M35S"), 95)
        self.assertEqual(parse_iso_duration("PT2H1M35S"), 7295)
        self.assertIsNone(parse_iso_duration("garbage"))
        self.assertIsNone(parse_iso_duration(None))
        self.assertIsNone(parse_iso_duration(float("nan")))

    def test_binary_res(self):
        self.assertEqual(parse_binary_res("1@XX@1@XX@"), (2, 2))
        self.assertEqual(parse_binary_res("0@XX@0@XX@"), (2, 0))
        self.assertEqual(parse_binary_res("0@XX@1@XX@"), (2, 1))
        self.assertEqual(parse_binary_res(""), (0, 0))
        self.assertEqual(parse_binary_res(None), (0, 0))

    def test_time_cols(self):
        s = pd.Series(["2024-09-02 13:49:10", "2025-01-27 05:07:23", None])
        t = time_cols(s)
        self.assertEqual(t.loc[0, "年"], 2024)
        self.assertEqual(t.loc[0, "月"], 9)
        self.assertEqual(t.loc[0, "星期"], "週一")   # 2024-09-02 是週一
        self.assertEqual(t.loc[0, "時段"], "下午")   # 13 時
        self.assertEqual(t.loc[1, "星期"], "週一")   # 2025-01-27 是週一
        self.assertEqual(t.loc[1, "時段"], "凌晨")   # 5 時
        self.assertEqual(t.loc[0, "週次"], "2024-W36")
        self.assertTrue(pd.isna(t.loc[2, "年"]))


if __name__ == "__main__":
    unittest.main(verbosity=2)
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `$env:PYTHONIOENCODING="utf-8"; python D:\bi-final\scripts\test_prepare_edu.py`
Expected: FAIL（ModuleNotFoundError: prepare_edu）

- [ ] **Step 3: 寫 `scripts/prepare_edu.py` 的輔助函式部分**

```python
# -*- coding: utf-8 -*-
"""教育大數據 2025 微學程開放資料 → Power BI 分析就緒表。

輸入：彰師bi/2025教育大數據微學程教學用開放資料/*.csv（tab 分隔，不入庫）
輸出：data/edu/{edu_activity,edu_users,edu_video,edu_difficulty}.csv（UTF-8 BOM）
（每個前處理步驟同時是期末報告「二、資料來源與前處理」一節的素材。）
"""
import re
import sys
from pathlib import Path

import pandas as pd

BASE = Path(__file__).resolve().parents[1]
SRC = BASE / "彰師bi" / "2025教育大數據微學程教學用開放資料"
OUT = BASE / "data" / "edu"

SLOTS = [(0, 6, "凌晨"), (6, 12, "上午"), (12, 18, "下午"), (18, 24, "晚上")]
WEEKDAY = ["週一", "週二", "週三", "週四", "週五", "週六", "週日"]

USER_RENAME = {
    "user_sn": "使用者編號", "organization_id": "學校代碼", "grade": "年級",
    "class": "班級", "chinese_score": "國文成績", "math_score": "數學成績",
    "english_score": "英語成績",
}


def read_tsv(name: str) -> pd.DataFrame:
    return pd.read_csv(SRC / f"{name}.csv", sep="\t", low_memory=False)


def parse_iso_duration(s):
    """ISO8601 時長（'PT2H1M35S'/'PT0M21S'/'PT5S'）→ 秒；無法解析 → None。"""
    if not isinstance(s, str):
        return None
    m = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?", s)
    if not m or not any(m.groups()):
        return None
    h, mi, sec = (float(g) if g else 0.0 for g in m.groups())
    return h * 3600 + mi * 60 + sec


def parse_binary_res(s):
    """'1@XX@0@XX@'（字面 @XX@ 分隔、尾隨分隔符）→ (題數, 答對數)。"""
    if not isinstance(s, str):
        return (0, 0)
    items = [x for x in s.split("@XX@") if x in ("0", "1")]
    return (len(items), sum(int(x) for x in items))


def time_cols(ts: pd.Series) -> pd.DataFrame:
    """datetime-like Series → DataFrame(時間, 年, 月, 週次, 星期, 時段)。"""
    ts = pd.to_datetime(ts, errors="coerce")
    iso = ts.dt.isocalendar()
    week = iso.year.astype("Int64").astype(str) + "-W" + iso.week.astype("Int64").astype(str).str.zfill(2)
    week = week.where(ts.notna())
    slot = ts.dt.hour.map(
        lambda h: next(lab for lo, hi, lab in SLOTS if lo <= h < hi) if pd.notna(h) else None
    )
    return pd.DataFrame({
        "時間": ts,
        "年": ts.dt.year,
        "月": ts.dt.month,
        "週次": week,
        "星期": ts.dt.weekday.map(lambda d: WEEKDAY[int(d)] if pd.notna(d) else None),
        "時段": slot,
    })


def to_naive_taipei(s: pd.Series) -> pd.Series:
    """含 +08:00 時區的 ISO 字串 → 台北時間 naive datetime。"""
    return pd.to_datetime(s, errors="coerce", utc=True).dt.tz_convert("Asia/Taipei").dt.tz_localize(None)


def ms_to_taipei(s: pd.Series) -> pd.Series:
    """Unix 毫秒（UTC）→ 台北時間 naive datetime。"""
    return pd.to_datetime(s, unit="ms", errors="coerce", utc=True).dt.tz_convert("Asia/Taipei").dt.tz_localize(None)
```

- [ ] **Step 4: 跑測試確認通過**

Run: `$env:PYTHONIOENCODING="utf-8"; python D:\bi-final\scripts\test_prepare_edu.py`
Expected: 3 tests PASS（time_cols 的週一/週次斷言若失敗，先用 `python -c "import datetime;print(datetime.date(2024,9,2).isoweekday())"` 驗日曆而非改函式）。

- [ ] **Step 5: Commit**

```powershell
git -C D:\bi-final add scripts/
git -C D:\bi-final commit -m "feat(edu): prepare_edu helpers with unit tests (TDD)"
```

### Task 4: prepare_edu 主體（四個產出表＋asserts）

**Files:**
- Modify: `scripts/prepare_edu.py`（追加主體）
- Create（執行產物）: `data/edu/edu_activity.csv`、`data/edu/edu_users.csv`、`data/edu/edu_video.csv`、`data/edu/edu_difficulty.csv`

- [ ] **Step 1: 在 `prepare_edu.py` 追加建表函式與 main**

```python
PLATFORM_EVENTS = [
    # (來源檔, 平臺, 行為類型, 時間欄, 時間轉換)
    ("dp001_prac", "dp001 影音學習", "練習作答", "date", None),
    ("dp001_review", "dp001 影音學習", "影片瀏覽", "start_time", None),
    ("dp002_exam", "dp002 測驗平臺", "測驗作答", "action_time", "iso"),
    ("dp003_word", "dp003 遊戲學習", "單字遊戲", "start_timestamp", None),
    ("dp003_math", "dp003 遊戲學習", "數學遊戲", "last_modified", "ms"),
    ("dp004_interaction", "dp004 綜合學習", "回答問題", "timestamp", "iso"),
    ("dp004_video", "dp004 綜合學習", "觀看影片", "timestamp", "iso"),
    ("dp004_webpage", "dp004 綜合學習", "瀏覽資源", "timestamp", "iso"),
]


def build_activity(users: pd.DataFrame) -> pd.DataFrame:
    parts = []
    for name, platform, action, tcol, conv in PLATFORM_EVENTS:
        df = read_tsv(name)
        t = df[tcol]
        if conv == "iso":
            t = to_naive_taipei(t)
        elif conv == "ms":
            t = ms_to_taipei(t)
        part = pd.DataFrame({"使用者編號": df["user_sn"], "平臺": platform, "行為類型": action})
        part = pd.concat([part.reset_index(drop=True), time_cols(t).reset_index(drop=True)], axis=1)
        parts.append(part)
    act = pd.concat(parts, ignore_index=True)
    return act.merge(users[["使用者編號", "學校代碼", "年級", "班級"]], on="使用者編號", how="left")


def build_users(users: pd.DataFrame) -> pd.DataFrame:
    prac = read_tsv("dp001_prac")
    review = read_tsv("dp001_review")
    plus = read_tsv("dp001_review_plus")

    prac_g = prac.groupby("user_sn").agg(
        練習次數=("prac_sn", "count"),
        練習平均正確率=("score_rate", "mean"),
        練習總秒數=("during_time", "sum"),
    )
    review = review.assign(covered=(review["end_timestamp"] - review["start_timestamp"]).clip(lower=0))
    rev_g = review.groupby("user_sn").agg(
        影片瀏覽次數=("review_sn", "count"),
        影片觀看總秒數=("covered", "sum"),
        影片平均完成率=("finish_rate", "mean"),
    )
    # review_plus 沒有 user_sn → 經 review_sn 接回使用者
    plus_u = plus.merge(review[["review_sn", "user_sn"]], on="review_sn", how="inner")
    ACTION_LABEL = {"dragleft": "倒轉次數", "dragright": "快轉次數", "paused": "暫停次數", "note": "筆記次數"}
    plus_g = (
        plus_u[plus_u["view_action"].isin(ACTION_LABEL)]
        .groupby(["user_sn", "view_action"]).size().unstack(fill_value=0)
        .rename(columns=ACTION_LABEL)
    )
    exam2 = read_tsv("dp002_exam")
    exam2_sec = exam2.assign(sec=exam2["result_duration"].map(parse_iso_duration))
    counts = {
        "單字遊戲次數": read_tsv("dp003_word").groupby("user_sn").size(),
        "數學遊戲次數": read_tsv("dp003_math").groupby("user_sn").size(),
        "測驗作答次數": exam2.groupby("user_sn").size(),
        "測驗總秒數": exam2_sec.groupby("user_sn")["sec"].sum(),
        "綜合平臺活動數": pd.concat([
            read_tsv("dp004_interaction")["user_sn"],
            read_tsv("dp004_video")["user_sn"],
            read_tsv("dp004_webpage")["user_sn"],
        ]).value_counts(),
    }
    out = users.set_index("使用者編號")
    for g in (prac_g, rev_g, plus_g):
        out = out.join(g.rename_axis("使用者編號"))
    for col, s in counts.items():
        out[col] = s.rename_axis("使用者編號")

    count_cols = ["練習次數", "練習總秒數", "影片瀏覽次數", "影片觀看總秒數", "倒轉次數",
                  "快轉次數", "暫停次數", "筆記次數", "單字遊戲次數", "數學遊戲次數",
                  "測驗作答次數", "測驗總秒數", "綜合平臺活動數"]
    for c in count_cols:
        if c not in out.columns:
            out[c] = 0
        out[c] = out[c].fillna(0).astype(int)
    out["練習平均正確率"] = out["練習平均正確率"].round(1)
    out["影片平均完成率"] = out["影片平均完成率"].round(1)
    out["影片觀看總秒數"] = out["影片觀看總秒數"].round(0).astype(int)
    out["總活動量"] = (out["練習次數"] + out["影片瀏覽次數"] + out["單字遊戲次數"]
                      + out["數學遊戲次數"] + out["測驗作答次數"] + out["綜合平臺活動數"])
    out["參與度分組"] = pd.qcut(out["總活動量"].rank(method="first"), 4,
                              labels=["Q1 低", "Q2 中低", "Q3 中高", "Q4 高"])
    return out.reset_index()


def build_video(users: pd.DataFrame) -> pd.DataFrame:
    review = read_tsv("dp001_review")
    plus = read_tsv("dp001_review_plus")
    ACTION_LABEL = {"play": "播放次數", "paused": "暫停次數", "dragleft": "倒轉次數",
                    "dragright": "快轉次數", "note": "筆記次數", "chkptstart": "檢核點作答次數"}
    acts = (
        plus[plus["view_action"].isin(ACTION_LABEL)]
        .groupby(["review_sn", "view_action"]).size().unstack(fill_value=0)
        .rename(columns=ACTION_LABEL)
    )
    v = review.rename(columns={
        "review_sn": "影片瀏覽編號", "user_sn": "使用者編號", "subject_name": "科目",
        "video_name": "影片名稱", "video_len": "影片長度秒", "finish_rate": "完成率",
    })
    v = pd.concat([v.reset_index(drop=True), time_cols(review["start_time"]).reset_index(drop=True)], axis=1)
    v = v.merge(acts.rename_axis("影片瀏覽編號"), left_on="影片瀏覽編號", right_index=True, how="left")
    for c in ACTION_LABEL.values():
        if c not in v.columns:
            v[c] = 0
        v[c] = v[c].fillna(0).astype(int)
    v = v.merge(users[["使用者編號", "學校代碼", "年級"]], on="使用者編號", how="left")
    keep = ["影片瀏覽編號", "使用者編號", "學校代碼", "年級", "科目", "影片名稱", "影片長度秒",
            "完成率", "時間", "年", "月", "週次", "星期", "時段", *ACTION_LABEL.values()]
    return v[keep]


def build_difficulty() -> pd.DataFrame:
    prac = read_tsv("dp001_prac")
    nb = prac["binary_res"].map(parse_binary_res)
    prac = prac.assign(題數=nb.map(lambda t: t[0]), 答對數=nb.map(lambda t: t[1]))
    ind = prac.groupby(["indicator_name", "subject_name"], as_index=False).agg(
        嘗試次數=("題數", "sum"), 答對數=("答對數", "sum"))
    ind = ind[ind["嘗試次數"] > 0].assign(
        類型="能力指標",
        錯誤次數=lambda d: d["嘗試次數"] - d["答對數"],
        正確率=lambda d: (d["答對數"] / d["嘗試次數"] * 100).round(1),
    ).rename(columns={"indicator_name": "名稱", "subject_name": "科目"})

    word = read_tsv("dp003_word")
    wg = word.groupby("target_vocabulary", as_index=False).agg(
        嘗試次數=("is_correct", "count"), 答對數=("is_correct", "sum"))
    wg = wg.assign(
        類型="英文單字", 科目="英語",
        錯誤次數=lambda d: d["嘗試次數"] - d["答對數"],
        正確率=lambda d: (d["答對數"] / d["嘗試次數"] * 100).round(1),
    ).rename(columns={"target_vocabulary": "名稱"})

    math = read_tsv("dp003_math")
    mg = math.groupby("unit_name", as_index=False).agg(
        嘗試次數=("is_correct", "count"), 答對數=("is_correct", "sum"))
    mg = mg.assign(
        類型="數學單元", 科目="數學",
        錯誤次數=lambda d: d["嘗試次數"] - d["答對數"],
        正確率=lambda d: (d["答對數"] / d["嘗試次數"] * 100).round(1),
    ).rename(columns={"unit_name": "名稱"})

    cols = ["類型", "名稱", "科目", "嘗試次數", "錯誤次數", "正確率"]
    return pd.concat([ind[cols], wg[cols], mg[cols]], ignore_index=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    users = read_tsv("user_data").rename(columns=USER_RENAME)

    activity = build_activity(users)
    users_out = build_users(users)
    video = build_video(users)
    difficulty = build_difficulty()

    # --- 驗證（spec §4/§10）---
    expected_rows = 6624 + 4567 + 41864 + 2140 + 1365 + 15392 + 6086 + 23642
    assert len(activity) == expected_rows, f"activity rows {len(activity)} != {expected_rows}"
    assert len(users_out) == 313 and users_out["使用者編號"].is_unique
    assert users_out[["國文成績", "數學成績", "英語成績"]].isna().sum().tolist() == [120, 45, 112]
    assert (users_out["總活動量"] >= 0).all() and (users_out["練習總秒數"] >= 0).all()
    assert users_out["參與度分組"].value_counts().min() >= 78  # 四分位每組約 78
    assert len(video) == 4567 and (video["完成率"].dropna() >= 0).all()
    assert (difficulty["正確率"].between(0, 100)).all()
    assert set(activity["平臺"].unique()) == {"dp001 影音學習", "dp002 測驗平臺", "dp003 遊戲學習", "dp004 綜合學習"}

    for name, df in [("edu_activity", activity), ("edu_users", users_out),
                     ("edu_video", video), ("edu_difficulty", difficulty)]:
        df.to_csv(OUT / f"{name}.csv", index=False, encoding="utf-8-sig")
        print(f"{name}.csv: {len(df)} rows, {len(df.columns)} cols")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 跑單元測試（不退步）**

Run: `$env:PYTHONIOENCODING="utf-8"; python D:\bi-final\scripts\test_prepare_edu.py`
Expected: PASS

- [ ] **Step 3: 執行主體**

Run: `$env:PYTHONIOENCODING="utf-8"; python D:\bi-final\scripts\prepare_edu.py`
Expected: 印出 4 行 `*.csv: N rows`，activity=101,680、users=313、video=4,567，difficulty 為數百列（能力指標 ≤661＋單字＋數學單元）；無 AssertionError。若 assert 失敗：先檢查資料假設（印出實際值），不要直接放寬斷言。

- [ ] **Step 4: 抽查輸出**

Run: `Get-Content D:\bi-final\data\edu\edu_users.csv -TotalCount 3`
Expected: BOM＋中文欄頭（使用者編號,學校代碼,…,參與度分組），數值欄無小數爆炸。

- [ ] **Step 5: Commit**

```powershell
git -C D:\bi-final add scripts/prepare_edu.py data/edu/
git -C D:\bi-final commit -m "feat(edu): build 4 analysis-ready tables from edu big data"
```

### Task 5: 推上 GitHub、驗證 Pages URL

- [ ] **Step 1: Push**

Run: `git -C D:\bi-final push origin main`

- [ ] **Step 2: 等 Pages 部署後驗證資料 URL（重試至多 5 次、每次間隔 30s）**

Run: `curl.exe -s -o NUL -w "%{http_code}" https://bruhmoment03.github.io/taiwan-weather-observatory/data/edu/edu_users.csv`
Expected: `200`。再抓前 200 bytes 確認是 CSV 內容非 404 頁。

- [ ] **Step 3: 瀏覽器驗證網站首頁**

開 `https://bruhmoment03.github.io/taiwan-weather-observatory/`
Expected: 新作品集首頁（非舊 Observatory）。

---

## Phase 2：Power BI 四報表＋Word＋影片稿

### Task 6: PBI 登入＋發佈至 Web 探測（INTERACTIVE）

**前置：** 使用者在場。先以 ToolSearch 載入 chrome 工具（tabs_context_mcp → tabs_create_mcp → computer/read_page）。

- [ ] **Step 1:** `tabs_context_mcp` 取得瀏覽器狀態 → 新分頁開 `https://app.powerbi.com`
- [ ] **Step 2:** 請使用者登入 NCUE 帳號（s1261028@mail.ncue.edu.tw）。等待「我的工作區」可見。
- [ ] **Step 3:** 發佈至 Web 探測：開啟任一既有報表（上次的「台灣天氣即時儀表板」若仍在），選 檔案 → 內嵌報表 → 發佈至網站(公開)。
  - 出現嵌入碼對話框 → **記錄 VERDICT=可用**。
  - 出現「請連絡您的系統管理員以啟用內嵌程式碼建立」→ **記錄 VERDICT=封鎖**，後續一律截圖備援。
- [ ] **Step 4:** 把 VERDICT 寫進本檔案此處：`VERDICT: ＿＿＿`（執行時回填），並回報使用者。

### Task 7: 建置報表 1–4（INTERACTIVE）

**通用建模流程（每份報表重複）：**
1. 我的工作區 → 新增項目／取得資料 → **CSV**（連結到檔案）→ 貼 URL → 認證「匿名」→ 建立語意模型。
2. 開啟語意模型 → 編輯資料模型：把下表「數值欄」設為數字型態（整數/小數）。
3. 語意模型 →「建立報表」→ 依視覺清單拖欄位 → 重新命名標題（雙擊）→ 儲存為指定名稱。
4. VERDICT=可用 → 檔案→內嵌報表→發佈至網站 → 複製 `https://app.powerbi.com/view?r=...` 填入 `js/embeds.js` 對應 `embedUrl`；同時把報表閱讀檢視網址填入 `reportLink`。
5. 視窗調 1600×900，報表閱讀檢視全頁截圖 → 存 `D:\bi-final\assets\reportN.png`。

| 報表 | CSV URL（前綴 `https://bruhmoment03.github.io/taiwan-weather-observatory/data/edu/`） | 模型/報表名 | 數值欄 |
|------|------|------|------|
| 1 | `edu_activity.csv` | `edu_activity`／`報表1 學習平臺使用概況` | 年、月、年級、班級 |
| 2 | `edu_users.csv` | `edu_users`／`報表2 學習行為與成績關聯` | 三科成績、各行為計數、總活動量、兩個平均率 |
| 3 | `edu_video.csv` | `edu_video`／`報表3 影片學習行為解析` | 影片長度秒、完成率、各事件次數 |
| 4 | `edu_difficulty.csv` | `edu_difficulty`／`報表4 科目與能力難點` | 嘗試次數、錯誤次數、正確率 |

- [ ] **Step 1: 報表1 視覺清單**（單頁）
  - 卡片×3：使用者編號 相異計數「使用者人數」；學校代碼 相異計數「學校數」；資料列計數「總活動量」
  - 群組直條：X=年級、Y=使用者編號 相異計數
  - 圓環：圖例=平臺、值=資料列計數
  - 折線：X=週次（軸排序遞增）、Y=資料列計數、圖例=平臺 →「每週活動趨勢」
  - 矩陣熱度：列=星期、欄=時段、值=資料列計數 → 設定儲存格背景色階
  - 交叉分析篩選器：平臺
- [ ] **Step 2: 報表1 發佈/截圖**（依通用流程 4–5）
- [ ] **Step 3: 報表2 視覺清單**（單頁，主打）
  - 散佈：X=練習平均正確率、Y=數學成績、詳細資料=使用者編號、圖例=年級、＋趨勢線 →「練習正確率 × 數學成績」
  - 散佈：X=影片平均完成率、Y=英語成績、詳細資料=使用者編號、圖例=年級、＋趨勢線
  - 群組直條：X=參與度分組、Y=國文/數學/英語成績 的平均（三序列）→「參與度 × 平均成績」
  - 卡片×3：練習次數 平均、影片平均完成率 平均、總活動量 平均
  - 交叉分析篩選器×2：學校代碼、年級
- [ ] **Step 4: 報表2 發佈/截圖**
- [ ] **Step 5: 報表3 視覺清單**（單頁）
  - 直條（分組箱）：X=完成率（建議分箱：於服務「新增群組」若可用，否則直接用完成率欄）→「完成率分布」
  - 橫條：Y=科目、X=完成率 平均 →「各科目平均完成率」
  - 100% 堆疊橫條：Y=科目、值=暫停/倒轉/快轉/筆記次數 總和 →「行為事件組成」
  - 橫條 Top10：Y=影片名稱、X=倒轉次數 總和、視覺篩選=前 10 →「最常被倒轉的影片（教材難點）」
  - 交叉分析篩選器：科目
- [ ] **Step 6: 報表3 發佈/截圖**
- [ ] **Step 7: 報表4 視覺清單**（單頁）
  - 直條：X=科目、Y=正確率 平均（視覺篩選 類型=能力指標）→「各科正確率」
  - 橫條 Top10：Y=名稱、X=正確率 平均 遞增排序、視覺篩選：類型=能力指標 且 嘗試次數總和>=30、前 10 →「最弱能力指標」
  - 橫條 Top10：Y=名稱、X=錯誤次數 總和、視覺篩選 類型=英文單字 →「最難英文單字」
  - 橫條：Y=名稱、X=正確率 平均 遞增、視覺篩選 類型=數學單元 →「數學單元正確率」
  - 樹狀圖：類別=科目、詳細資料=名稱、值=嘗試次數 總和
  - 交叉分析篩選器：類型
- [ ] **Step 8: 報表4 發佈/截圖**
- [ ] **Step 9: 把 4 個 embedUrl/reportLink（或截圖備援）寫入 `js/embeds.js`，跑 `node --test D:\bi-final\test\`，commit**

```powershell
git -C D:\bi-final add assets/ js/embeds.js
git -C D:\bi-final commit -m "feat(report): four edu dashboards (screenshots + embed config)"
```

**服務功能缺位備援（spec §9）：** 服務報表編輯器無「新增群組」分箱 → 完成率分布直接以完成率為 X 的直方視覺替代；無趨勢線 → 散佈圖仍可，發現敘述以相關係數（Task 8 計算）支撐。

### Task 8: 發現統計（edu_findings.py）＋撰寫發現文案

**Files:**
- Create: `scripts/edu_findings.py`、`report/findings_stats.txt`（執行產物）、`report/findings.json`（人工撰寫）

- [ ] **Step 1: 寫 `scripts/edu_findings.py`**

```python
# -*- coding: utf-8 -*-
"""從 data/edu/*.csv 計算期末報告引用的關鍵統計，輸出 report/findings_stats.txt。"""
from pathlib import Path
import pandas as pd

BASE = Path(__file__).resolve().parents[1]
EDU = BASE / "data" / "edu"
OUTDIR = BASE / "report"


def main():
    OUTDIR.mkdir(exist_ok=True)
    users = pd.read_csv(EDU / "edu_users.csv")
    act = pd.read_csv(EDU / "edu_activity.csv")
    video = pd.read_csv(EDU / "edu_video.csv")
    diff = pd.read_csv(EDU / "edu_difficulty.csv")
    lines = []
    w = lines.append

    w("== 主題1 使用概況 ==")
    w(f"使用者 {users['使用者編號'].nunique()} 人、學校 {users['學校代碼'].nunique()} 所，年級分布:")
    w(users.groupby('年級')['使用者編號'].count().to_string())
    w("各平臺活動量:"); w(act['平臺'].value_counts().to_string())
    w("星期分布:"); w(act['星期'].value_counts().to_string())
    w("時段分布:"); w(act['時段'].value_counts().to_string())
    w("活動量前 5 週:"); w(act['週次'].value_counts().head(5).to_string())

    w("\n== 主題2 行為×成績（皮爾森相關，成績缺漏列排除）==")
    for b in ["練習次數", "練習平均正確率", "影片瀏覽次數", "影片平均完成率", "總活動量"]:
        for s in ["國文成績", "數學成績", "英語成績"]:
            sub = users[[b, s]].dropna()
            w(f"corr({b},{s}) = {sub[b].corr(sub[s]):.3f}  (n={len(sub)})")
    w("參與度分組平均成績:")
    w(users.groupby("參與度分組", observed=True)[["國文成績", "數學成績", "英語成績"]].mean().round(1).to_string())

    w("\n== 主題3 影片行為 ==")
    w(f"完成率平均 {video['完成率'].mean():.1f}%、>=90% 比率 {(video['完成率']>=90).mean()*100:.1f}%")
    w("各科平均完成率:"); w(video.groupby("科目")["完成率"].mean().round(1).to_string())
    w("最常被倒轉影片 Top10:")
    w(video.groupby("影片名稱")["倒轉次數"].sum().sort_values(ascending=False).head(10).to_string())
    w("筆記次數最多影片 Top5:")
    w(video.groupby("影片名稱")["筆記次數"].sum().sort_values(ascending=False).head(5).to_string())

    w("\n== 主題4 難點 ==")
    ind = diff[(diff["類型"] == "能力指標") & (diff["嘗試次數"] >= 30)]
    w("最弱能力指標 Top10（嘗試>=30）:")
    w(ind.nsmallest(10, "正確率")[["名稱", "科目", "嘗試次數", "正確率"]].to_string(index=False))
    w("最難英文單字 Top10（依錯誤次數）:")
    w(diff[diff["類型"] == "英文單字"].nlargest(10, "錯誤次數")[["名稱", "嘗試次數", "錯誤次數", "正確率"]].to_string(index=False))
    w("數學單元正確率（遞增）:")
    w(diff[diff["類型"] == "數學單元"].sort_values("正確率")[["名稱", "嘗試次數", "正確率"]].to_string(index=False))

    text = "\n".join(lines)
    (OUTDIR / "findings_stats.txt").write_text(text, encoding="utf-8")
    print(text)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 執行**

Run: `$env:PYTHONIOENCODING="utf-8"; python D:\bi-final\scripts\edu_findings.py`
Expected: 完整統計輸出、`report/findings_stats.txt` 生成。

- [ ] **Step 3: 依統計撰寫 `report/findings.json`**（資料相依的撰寫步驟——文案必須引用 Step 2 的實際數字，採老師例示句式「發現○○最多／○○顯著」）

結構（鍵固定，值為段落陣列，每主題 2–3 段、每段 80–150 字）：

```json
{
  "research_questions": [
    "學生在四個學習平臺上的使用量與使用時間分布為何？",
    "學習平臺上的行為投入（練習量、正確率、影片完成率）與國數英成績是否相關？",
    "學生如何觀看教學影片？哪些影片最常被倒轉、暫停，反映教材難點？",
    "哪些科目、能力指標、英文單字與數學單元是學生最容易出錯的難點？"
  ],
  "theme1": ["…使用實際統計數字…"],
  "theme2": ["…"],
  "theme3": ["…"],
  "theme4": ["…"],
  "conclusion": ["…2–3 段，跨主題收束＋具體建議…"]
}
```

- [ ] **Step 4: Commit（注意 report/ 已 gitignore——只 commit 腳本）**

```powershell
git -C D:\bi-final add scripts/edu_findings.py
git -C D:\bi-final commit -m "feat(report): findings stats extractor"
```

### Task 9: Word 報告生成

**Files:**
- Create: `scripts/build_report_docx.py`、`report/cover.json`（依使用者答覆）、`report/期末報告.docx`（產物）

- [ ] **Step 1: 安裝 python-docx**

Run: `pip install python-docx`
Expected: Successfully installed（或 already satisfied）。

- [ ] **Step 2: 以 AskUserQuestion 收集封面資訊** → 寫 `report/cover.json`：

```json
{
  "title": "運用 Power BI 分析國小學習平臺行為與學業成績",
  "name": "（使用者答覆）",
  "student_id": "（使用者答覆）",
  "department": "（使用者答覆）",
  "advisor": "（使用者答覆）",
  "date": "中華民國 115 年 6 月",
  "video_url": ""
}
```

- [ ] **Step 3: 寫 `scripts/build_report_docx.py`**

```python
# -*- coding: utf-8 -*-
"""組裝期末報告 Word 檔：report/cover.json + report/findings.json + assets/report*.png
→ report/期末報告.docx。可重複執行（影片連結補上後重新生成）。"""
import json
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt

BASE = Path(__file__).resolve().parents[1]
REPORT = BASE / "report"
ASSETS = BASE / "assets"

FILES_TABLE = [  # 檔名, 筆數, 欄數, 內容
    ("user_data.csv", "313", "7", "學校、年級、班級、國數英成績"),
    ("dp001_prac.csv", "6,624", "9", "練習作答（正確率、能力指標、作答串）"),
    ("dp001_review.csv", "4,567", "11", "影片瀏覽（影片、起迄、完成率）"),
    ("dp001_review_plus.csv", "118,390", "6", "影片操作事件（播放/暫停/拖曳/筆記）"),
    ("dp001_exam.csv", "1,763", "7", "影片檢核點作答"),
    ("dp002_exam.csv", "41,864", "8", "測驗平臺題項作答紀錄"),
    ("dp003_word.csv", "2,140", "13", "英文單字遊戲（目標單字、累積對錯）"),
    ("dp003_math.csv", "1,365", "10", "數學遊戲（單元、對錯、耗時）"),
    ("dp004_interaction.csv", "15,392", "9", "綜合平臺測驗互動"),
    ("dp004_video.csv", "6,086", "7", "綜合平臺觀影紀錄"),
    ("dp004_webpage.csv", "23,642", "6", "綜合平臺學習資源瀏覽"),
]

RENAME_TABLE = [
    ("user_sn", "使用者編號"), ("organization_id", "學校代碼"), ("grade", "年級"),
    ("class", "班級"), ("chinese_score", "國文成績"), ("math_score", "數學成績"),
    ("english_score", "英語成績"), ("subject_name", "科目"), ("video_name", "影片名稱"),
    ("finish_rate", "完成率"), ("indicator_name", "能力指標"), ("score_rate", "練習正確率"),
]

PREP_STEPS = [
    "Tab 分隔原始檔轉為標準 CSV，統一輸出 UTF-8（含 BOM）以利 Power BI 讀取中文。",
    "欄位重新命名：所有英文欄名改為中文（對照表如表 2），提升報表可讀性。",
    "缺失值處理：國文、數學、英語成績各有 120、45、112 筆缺漏；行為彙總保留全部 313 位使用者，"
    "與成績相關之分析則逐科排除缺漏列並於圖表註記樣本數。",
    "時間標準化：dp002/dp004 之 ISO8601 含時區時間戳與 dp003 之 Unix 毫秒時間戳，統一轉為台北時間，"
    "並衍生年、月、週次、星期、時段欄位以利時間序列分析。",
    "作答串解析：dp001_prac 的 binary_res 以「@XX@」分隔之 0/1 字串，解析為題數與答對數。",
    "測驗時長之 ISO8601 格式（如 PT1M35S）轉換為秒數。",
    "彙整合併：以使用者編號為鍵串接 user_data，分別彙總出事件層（edu_activity）、使用者層（edu_users）、"
    "影片瀏覽層（edu_video）與題項難點層（edu_difficulty）四個分析就緒表。",
]

PREP_CODE = '''import pandas as pd, re

def parse_binary_res(s):                      # '1@XX@0@XX@' -> (題數, 答對數)
    items = [x for x in str(s).split("@XX@") if x in ("0", "1")]
    return len(items), sum(map(int, items))

def parse_iso_duration(s):                    # 'PT1M35S' -> 95 秒
    m = re.fullmatch(r"PT(?:(\\d+)H)?(?:(\\d+)M)?(?:(\\d+)S)?", str(s))
    h, mi, sec = (int(g) if g else 0 for g in m.groups())
    return h * 3600 + mi * 60 + sec

users = pd.read_csv(SRC / "user_data.csv", sep="\\t").rename(columns=USER_RENAME)
# 成績缺漏：行為彙總保留、成績分析排除
out[count_cols] = out[count_cols].fillna(0).astype(int)'''

THEMES = [
    ("報表1 學習平臺使用概況", "report1.png", "theme1"),
    ("報表2 學習行為與成績關聯", "report2.png", "theme2"),
    ("報表3 影片學習行為解析", "report3.png", "theme3"),
    ("報表4 科目與能力難點", "report4.png", "theme4"),
]


def set_doc_font(doc):
    style = doc.styles["Normal"]
    style.font.name = "Times New Roman"
    style.font.size = Pt(12)
    style.element.rPr.rFonts.set(qn("w:eastAsia"), "標楷體")


def heading(doc, text, level):
    h = doc.add_heading(text, level=level)
    for run in h.runs:
        run.font.name = "Times New Roman"
        run.element.rPr.rFonts.set(qn("w:eastAsia"), "標楷體")
    return h


def para(doc, text, indent=True):
    p = doc.add_paragraph(("　　" if indent else "") + text)
    return p


def add_toc(doc):
    p = doc.add_paragraph()
    fld = OxmlElement("w:fldSimple")
    fld.set(qn("w:instr"), 'TOC \\o "1-2" \\h \\z \\u')
    run = OxmlElement("w:r")
    t = OxmlElement("w:t")
    t.text = "（在 Word 中按 F9 更新目錄）"
    run.append(t)
    fld.append(run)
    p._p.append(fld)


def simple_table(doc, headers, rows):
    tbl = doc.add_table(rows=1, cols=len(headers))
    tbl.style = "Table Grid"
    for i, h in enumerate(headers):
        tbl.rows[0].cells[i].text = h
    for r in rows:
        cells = tbl.add_row().cells
        for i, v in enumerate(r):
            cells[i].text = str(v)


def code_block(doc, code):
    p = doc.add_paragraph()
    run = p.add_run(code)
    run.font.name = "Consolas"
    run.font.size = Pt(9)


def main():
    cover = json.loads((REPORT / "cover.json").read_text(encoding="utf-8"))
    findings = json.loads((REPORT / "findings.json").read_text(encoding="utf-8"))

    doc = Document()
    set_doc_font(doc)

    # ---- 封面 ----
    for txt, size, before in [
        ("「商業智慧」期末報告", 20, 60),
        (cover["title"], 24, 24),
        (f"學生：{cover['department']}　{cover['student_id']}　{cover['name']}", 14, 60),
        (f"指導教授：{cover['advisor']}", 14, 6),
        (cover["date"], 14, 6),
        (f"影片連結：{cover['video_url'] or '（待補）'}", 12, 12),
    ]:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(before)
        run = p.add_run(txt)
        run.font.size = Pt(size)
        run.bold = size >= 20
        run.font.name = "Times New Roman"
        run.element.rPr.rFonts.set(qn("w:eastAsia"), "標楷體")
    doc.add_page_break()

    heading(doc, "目錄", 1)
    add_toc(doc)
    doc.add_page_break()

    # ---- 一、分析主題 ----
    heading(doc, "一、分析主題", 1)
    para(doc, "本報告以「2025 教育大數據微學程教學用開放資料」為對象，"
              "分析 313 位國小學生於四個數位學習平臺一學期（2024 年 9 月至 2025 年 1 月）的行為紀錄，"
              "預計回答以下四個問題：")
    for i, q in enumerate(findings["research_questions"], 1):
        para(doc, f"{i}. {q}", indent=False)

    # ---- 二、資料來源與前處理 ----
    heading(doc, "二、資料來源與前處理", 1)
    heading(doc, "（一）資料來源", 2)
    para(doc, "資料取自教育大數據分析計畫辦公室之「2025 教育大數據微學程教學用開放資料」，"
              "共 11 個檔案（tab 分隔 CSV），涵蓋 313 位使用者在 dp001（影音學習）、dp002（測驗）、"
              "dp003（遊戲學習）、dp004（綜合學習）四個平臺的操作紀錄與國數英測驗成績。"
              "本資料經匿名化處理，僅供教學用途，分析結果不得用於實務現象詮釋；使用已註明出處。")
    para(doc, "表 1　原始資料檔清單", indent=False)
    simple_table(doc, ["檔名", "筆數", "欄數", "內容"], FILES_TABLE)
    heading(doc, "（二）前處理步驟", 2)
    for i, s in enumerate(PREP_STEPS, 1):
        para(doc, f"{i}. {s}", indent=False)
    para(doc, "表 2　欄位重新命名對照（節錄）", indent=False)
    simple_table(doc, ["原欄名", "更名後"], RENAME_TABLE)
    para(doc, "Python（pandas）關鍵程式片段：", indent=False)
    code_block(doc, PREP_CODE)

    # ---- 三、資料分析與視覺化 ----
    heading(doc, "三、資料分析與視覺化", 1)
    para(doc, "前處理產出之四個分析就緒表，分別匯入 Power BI 服務建立語意模型與互動報表，"
              "以下依四大主題呈現儀表板與分析發現。")
    for idx, (title, png, key) in enumerate(THEMES, 1):
        heading(doc, f"（{'一二三四'[idx-1]}）{title}", 2)
        img = ASSETS / png
        if img.exists():
            doc.add_picture(str(img), width=Cm(16))
            doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
            cap = doc.add_paragraph(f"圖 {idx}　{title}")
            cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for paragraph in findings[key]:
            para(doc, paragraph)

    # ---- 四、結論 ----
    heading(doc, "四、結論與建議", 1)
    for paragraph in findings["conclusion"]:
        para(doc, paragraph)

    # ---- 影片說明 ----
    heading(doc, "五、影片說明", 1)
    para(doc, "本報告輔以儀表板實際操作之解說影片，依序說明四大主題之分析發現與圖表互動方式。")
    para(doc, f"影片連結：{cover['video_url'] or '（待補）'}", indent=False)

    out = REPORT / "期末報告.docx"
    doc.save(out)
    print(f"saved: {out} ({out.stat().st_size//1024} KB)")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: 執行生成**

Run: `$env:PYTHONIOENCODING="utf-8"; python D:\bi-final\scripts\build_report_docx.py`
Expected: `saved: ...期末報告.docx (>500 KB)`（含 4 張截圖）。

- [ ] **Step 5: 驗證 docx 內容**

```powershell
python -c "from docx import Document; d=Document(r'D:\bi-final\report\期末報告.docx'); print('paragraphs:', len(d.paragraphs)); print('images:', len(d.inline_shapes)); print('tables:', len(d.tables))"
```
Expected: images=4、tables=2、paragraphs>60。請使用者用 Word 開啟檢視（F9 更新目錄），確認排版可接受。

- [ ] **Step 6: Commit（只 commit 腳本，report/ 不入庫）**

```powershell
git -C D:\bi-final add scripts/build_report_docx.py
git -C D:\bi-final commit -m "feat(report): Word report generator (python-docx)"
```

### Task 10: 影片逐字稿與分鏡

**Files:**
- Create: `docs/video-script.md`

- [ ] **Step 1: 寫 `docs/video-script.md`**（文案為資料相依撰寫步驟——必須引用 `report/findings_stats.txt` 的實際數字；骨架如下）

```markdown
# 期末報告解說影片 — 逐字稿與分鏡（目標 5–7 分鐘）

> 錄製方式：開啟 Power BI 報表（或 report.html），OBS / PowerPoint 螢幕錄製，照稿朗讀。
> 每段「🖱️」是當下要做的滑鼠操作。

## 0. 開場（30 秒）
🖱️ 畫面停在 report.html 頂部（或報表1）。
「大家好，我是〇〇〇。這份期末報告使用教育大數據微學程開放資料，
分析 313 位國小學生在四個學習平臺、一整個學期的行為紀錄，
回答四個問題：誰在用、用得多成績好不好、影片怎麼看、以及哪裡最難。」

## 1. 報表1 使用概況（60–90 秒）
🖱️ 開報表1 → 滑過卡片 → 點「平臺」篩選器切換。
「……（引用實際數字：人數/學校、活動量最大的平臺、最熱門的星期與時段、週趨勢）……」

## 2. 報表2 行為×成績（90 秒，主打）
🖱️ 開報表2 → 指散佈圖趨勢 → 點年級篩選器。
「……（引用相關係數與參與度分組平均成績差距，講『發現…愈高、…也愈高/無明顯關聯』）……」

## 3. 報表3 影片行為（60–90 秒）
🖱️ 開報表3 → 指完成率分布 → 指 Top10 倒轉影片。
「……（引用平均完成率、最常被倒轉的影片名＝難點教材）……」

## 4. 報表4 難點（60–90 秒）
🖱️ 開報表4 → 點「類型」篩選器逐一切換。
「……（引用最弱能力指標、最難單字、最難數學單元）……」

## 5. 結語（20–30 秒）
「綜合以上四個面向……（兩句收束＋一句建議）。謝謝收看。」

## 錄後檢查
- [ ] 全長 5–7 分鐘、聲音清楚
- [ ] 上傳 YouTube（不公開/unlisted）
- [ ] 把連結交給 Claude 寫進 Word 與網站
```

- [ ] **Step 2: Commit**

```powershell
git -C D:\bi-final add docs/video-script.md
git -C D:\bi-final commit -m "docs: video narration script and storyboard"
```

---

## Phase 3：影片接線（等使用者錄完）

### Task 11: 影片連結回填＋收尾（INTERACTIVE）

- [ ] **Step 1:** 取得使用者提供的 YouTube 連結，擷取影片 ID。
- [ ] **Step 2:** 更新 `report/cover.json` 的 `video_url` → 重跑 `python scripts/build_report_docx.py` 重新生成 docx。
- [ ] **Step 3:** 更新 `js/embeds.js` 的 `VIDEO_ID`。
- [ ] **Step 4:** 跑 `node --test D:\bi-final\test\` → PASS。
- [ ] **Step 5:** 問使用者是否要把 docx 公開到網站。是 → `Copy-Item report\期末報告.docx assets\` 並在 `report.html` 影片區下加 `<p><a href="assets/期末報告.docx">下載完整報告（Word）</a></p>`；否 → 跳過。
- [ ] **Step 6: Commit＋push＋live 驗證**

```powershell
git -C D:\bi-final add -A
git -C D:\bi-final commit -m "feat(report): wire video link into site and report"
git -C D:\bi-final push origin main
```

開 `https://bruhmoment03.github.io/taiwan-weather-observatory/report.html`
Expected: 影片可播、四報表（iframe 或截圖）齊全。

- [ ] **Step 7:** 提醒使用者：**交件 = `report/期末報告.docx` ＋ 影片連結**（已含在 docx 封面與第五節）。
