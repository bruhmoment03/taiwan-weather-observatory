# bi-final 完全重做設計：教學檔三練習作品集

**日期：** 2026-06-05
**狀態：** 已與使用者逐節確認定案
**依據：** `彰師bi/教學檔.docx`（臺中科技大學 賴慧敏《Power BI 操作說明》，練習一/二/三）

## 1. 目標與成功標準

把 `D:\bi-final`（原 Taiwan Weather Observatory）完全重做為**教學檔三個練習的作品集網站**：

- 三張真正的 Power BI 報表（練習一 CWA 天氣、練習二 空氣品質、練習三 銷售業績），
  視覺效果、欄位、DAX 邏輯與教學檔成品一致。
- 一個 GitHub Pages 靜態網站：首頁 + 每個練習一頁（報表嵌入 + 製作說明）。
- **成功標準＝最終成果與教學檔一致**（使用者選定）。資料處理允許用
  Worker / 預處理 CSV 替代 Power Query 步驟，只要產出的表相同。

### 已確認的決策

| 決策 | 結論 |
|------|------|
| 最終形態 | 三個練習的作品集網站（砍掉舊 Observatory 前端） |
| Power BI 製作方式 | Claude 透過 Chrome 自動化在 app.powerbi.com 製作（使用者僅登入） |
| 帳號 | NCUE（s1261028@mail.ncue.edu.tw）；發佈至 Web 狀況未知 → 先探測、有備援 |
| 成功標準 | 最終成果一致即可，步驟可繞道 |
| Repo 名稱 | 沿用 `taiwan-weather-observatory`（Pages URL 不變） |

## 2. 整體架構

```
┌─ 資料層 ─────────────────────────────────────────────────┐
│  CWA F-C0032-001（36hr 預報, JSON, 即時）                  │
│      └→ Cloudflare Worker /forecast.csv   ← 練習一（live） │
│  data/aqx_p_08.csv（repo 內靜態）          ← 練習二         │
│  data/sales.csv（由 銷售業績.xlsx 預處理）  ← 練習三         │
└──────────────────────────────────────────────────────────┘
            ↓ Power BI 服務「取得資料 → CSV 連結」（匿名）
┌─ Power BI 層（app.powerbi.com，我的工作區，瀏覽器製作）─────┐
│  練習一 wx：地圖+卡片+篩選器，排程更新（台北時區）            │
│  練習二 空氣品質：矩陣+圖示+DAX                              │
│  練習三 銷售：環圈/折線直條/緞帶/堆疊/卡片/Sunburst（三頁）   │
└──────────────────────────────────────────────────────────┘
            ↓ 發佈至 Web iframe（被封鎖 → 高解析截圖+連結）
┌─ 網站層（GitHub Pages，純靜態，教學檔範本風格）─────────────┐
│  index.html ── ex1.html ── ex2.html ── ex3.html            │
└──────────────────────────────────────────────────────────┘
```

### Repo 重做範圍

- **刪除**：`js/`（views、data、state、anim、i18n、powerbi-embed 等）、`css/`、舊
  `data/*.json`、`scripts/fetch_data.py`、`.github/workflows/`、`powerbi.html`、
  `POWERBI.md`、`theme/powerbi-theme.json`、`test/embed.test.mjs`（舊嵌入頁測試）。
- **保留**：git 歷史；`worker/`（改造，見 §3）；`docs/superpowers/`。
- **不入庫**（加入 `.gitignore`）：`彰師bi/`（含 35MB 教學檔）、根目錄 `台灣天氣資料.xlsx`。
- **入庫**：`data/aqx_p_08.csv`、`data/sales.csv`（Power BI 需要公開 URL 連結）。

## 3. 資料層

### 3.1 Worker 改造（`worker/src/`）

- 資料集由 `C-B0024-001` 改為 **`F-C0032-001`**（一般天氣預報-今明36小時）。
- 移除舊路由 `/stations.csv`、`/observations.csv` 與 JSON payload 主路由；
  `/` 改回簡單健康資訊 JSON。
- 新路由 **`/forecast.csv`**：抓 F-C0032-001 → 重現教學檔 Power Query 樞紐結果：

  ```
  locationName, startTime, endTime, Wx, PoP, MinT, CI, MaxT
  （22 縣市 × 3 個 12 小時時段 = 66 列）
  ```

- 樞紐邏輯做成純函式 `buildForecastCsv(raw)`（`worker/src/forecast.js`），可單元測試。
- 既有機制保留：CWA key 只存於 Worker secret `CWA_API_KEY`、10 分鐘 edge cache、
  CORS `*`、UTF-8 CSV。匿名可取 → Power BI 排程更新可用。
- 舊測試 `worker/test/csv.test.mjs` 與 `worker/src/csv.js` 隨舊路由刪除，
  新增 `worker/test/forecast.test.mjs`（fixture JSON + `node --test`）。

### 3.2 銷售資料預處理（`scripts/prepare_sales.py`）

輸入 `彰師bi/銷售業績.xlsx`（顧客資料 4,005 列；訂單明細 5,626 列），輸出 `data/sales.csv`：

- 訂單列：訂單明細全欄位 ⨝ 顧客屬性（性別、年齡、居住地區、職業類別）。
- **Stub 列**：1,062 個無訂單顧客各一列（訂單欄位空白）。
  原因：教學檔的顧客計數來自完整顧客資料表（男 1,816 / 女 2,189，男 45.3%）；
  純訂單扁平表只剩 2,943 個顧客，比例會錯。Union 形狀 + `DISTINCTCOUNT(顧客編號)`
  才能逐數字重現。
- 預計算欄位（重現教學檔 Power Query / 群組步驟的產物）：
  - `年`、`月`、`日`、`季`（年中的季度，1–4）— 取自下單日期
  - `年齡層` = floor(年齡/10)×10（數值；對應教學檔「新增群組」bin 大小 10，範圍 20–76）
- 編碼 UTF-8 with BOM（與 aqx_p_08.csv 一致，Power BI 中文相容）。

### 3.3 空氣品質資料

`彰師bi/aqx_p_08.csv` 原樣複製到 `data/aqx_p_08.csv`（已是 UTF-8 BOM、1,000 資料列、
欄位 siteid/sitename/itemid/itemname/itemengname/itemunit/monitormonth/concentration，
monitormonth 全為 202603）。

## 4. Power BI 層（三張報表，皆在「我的工作區」）

通用：每個模型用「取得資料 → CSV → 連結到檔案」+ 對應 URL（匿名驗證）。
數值欄位在服務的模型編輯器設定型態。

### 4.1 練習一「wx」— 台灣今明 36 小時天氣預報

- 模型：`https://taiwan-weather-proxy.ii96391799.workers.dev/forecast.csv`；
  MinT/MaxT/PoP 設為數值。
- 視覺效果（依教學檔成品 image26）：
  - **地圖**：位置=locationName、圖例=PoP、泡泡大小=MaxT、工具提示=Wx；標題雙擊改中文。
  - **卡片 ×3**：最高溫（MaxT 最大值）、最低溫（MinT 最小值）、平均降雨機率%（PoP 平均）。
  - **交叉分析篩選器 ×2**：startTime（時間選擇）、locationName（磚塊式）。
  - 文字方塊：「資料來源：中央氣象署（CWA）開放資料平台」。
- **排程更新**：語意模型 → 資料來源認證=匿名 → 時區台北 → 每日 8 個時間點 → 套用。

### 4.2 練習二「空氣品質」— 2026年3月份台灣空氣品質監測

- 模型：`https://bruhmoment03.github.io/taiwan-weather-observatory/data/aqx_p_08.csv`。
- **矩陣**：列=sitename、行=item_display、值=concentration 的平均；行/列小計關閉；
  標題「2026年3月份台灣空氣品質監測」。
- **DAX 量值 `臭氧等級`**（教學檔原文）：SELECTEDVALUE(itemname)=「臭氧」時，
  AVERAGE(concentration) <30→1、<40→2、否則 3；其他測項 BLANK()。
- 條件格式化 → **圖示**：1=綠、2=黃、3=紅（依教學檔 image53 設定）。
- **DAX 計算資料行 `item_display`**：教學檔 SWITCH 全文（15 個測項加英文縮寫尾碼）。
- **交叉分析篩選器**：itemname，改名「空氣污染物」；設背景色。
- 文字方塊：「資料來源：環境部環境資訊科技司 [202603] [空氣品質監測月值]
  https://data.moenv.gov.tw/dataset/detail/AQX_P_08」。

### 4.3 練習三「銷售業績」— 顧客消費分析（三頁）

- 模型：`https://bruhmoment03.github.io/taiwan-weather-observatory/data/sales.csv`。
- 量值：`顧客數 = DISTINCTCOUNT(sales[顧客編號])`（所有「顧客計數」一律用此，
  數字才與教學檔一致）。
- **頁1 顧客分析**：
  - 環圈圖：顧客數 依 性別（期望全量 45.3% / 54.7%）。
  - 折線與群組直條圖：X=年齡層、直條=小計 的總和、折線=顧客數。
- **頁2 訂單分析**：
  - 緞帶圖：X=月、圖例=產品類別、Y=小計 的總和。
  - 堆疊直條圖：X=年/季/月/日（展開）、Y=小計 的總和。
  - 卡片：小計 的總和（標題「訂單金額」）。
- **頁3 客群探索**（依 image76/77）：
  - 交叉分析篩選器：居住地區。
  - 性別環圈 + 年齡折線直條（同頁1，受篩選器影響）。
  - **Sunburst**（AppSource 取得更多視覺效果）：資料系列=職業類別、資料行=性別、值=顧客數。
  - 卡片 ×2：顧客數、前 職業類別 個（First 職業類別）。
  - 矩陣：列=職業類別、行=性別、值=顧客數。
- 視覺層級篩選：訂單欄位的視覺（緞帶/堆疊/Sunburst 等）排除 stub 空白列
  （例如 訂單編號 非空白 / 產品類別 非空白）。

## 5. 網站層（GitHub Pages）

教學檔自身 HTML 範本風格放大成四頁：深色 `#1f2937` header、卡片容器、
圓角含陰影 iframe（高 850px）、footer 資料來源。純靜態、無建置步驟。

```
index.html      首頁：標題 + 三張練習卡片（縮圖、一句話、進入連結）
ex1.html        練習一：嵌入 + 製作說明（資料流程、樞紐 M 公式原文、排程更新設定）
ex2.html        練習二：嵌入 + 製作說明（臭氧等級 與 item_display DAX 全文）
ex3.html        練習三：嵌入 + 製作說明（年齡群組、Sunburst 安裝、量值設計）
css/site.css    共用樣式（單一檔案）
js/embeds.js    唯一設定點：EMBEDS = { ex1: { embedUrl, screenshot, reportLink }, … }
assets/         三張報表高解析截圖（兼任發佈被封時的備援畫面）
data/           aqx_p_08.csv、sales.csv（Power BI 連結來源）
```

`js/embeds.js` 渲染邏輯：`embedUrl` 非空 → iframe；空 → `<img>` 截圖 +
「在 Power BI 開啟報表」連結 + 註記。切換方案只改設定，HTML 不動。

## 6. 錯誤處理／備援

| 風險 | 偵測時機 | 備援 |
|------|---------|------|
| 發佈至 Web 仍被 NCUE 租用戶封鎖 | 瀏覽器階段第一步即探測 | 全部改截圖+連結模式（embeds.js 留空 embedUrl） |
| AppSource Sunburst 被租用戶封鎖 | 練習三建置時 | 內建樹狀圖替代 + 說明頁註記差異 |
| 服務無法建計算資料行 | 練習二建置時 | 預生成含 item_display 欄位的 CSV 載入 |
| 服務無法建量值（極不可能） | 練習二建置時 | 等級欄位預算進 CSV，圖示規則改用欄位 |
| CWA API 故障 | Worker 回 502 | 排程更新失敗保留舊資料；網站不受影響 |
| 瀏覽器自動化卡住 | 隨時 | 該步驟改為指示使用者手動完成（指南已在說明頁） |

## 7. 測試

- **Worker**：`buildForecastCsv` 純函式 + fixture（含缺值/單一時段等案例），
  `node --test` 跑 `worker/test/forecast.test.mjs`；部署後 curl 驗證列數=66、欄位=8。
- **prepare_sales.py**：腳本內建 assert — 輸出列數 5,626+1,062=6,688、
  顧客 distinct=4,005、性別 1,816/2,189、年齡層最小 20 最大 70、訂單列小計總和=原檔總和。
- **網站**：本機 server 逐頁瀏覽器驗證+截圖；部署後驗 live Pages。
- **Power BI**：每張報表完成即截圖與教學檔成品圖並排比對；練習一手動觸發
  重新整理一次確認端到端資料流。

## 8. 執行順序（0 → 1，五階段）

1. **Repo 重置**：刪舊前端 → `.gitignore` 課程素材 → 四頁網站骨架（佔位圖）→
   推上 GitHub（Pages 即生效，data/ URL 可被 Power BI 連）。
2. **資料**：跑 `prepare_sales.py` 產 `data/sales.csv`；複製 `aqx_p_08.csv`；
   Worker 改造 + 測試 + `wrangler deploy`。
3. **Power BI**（瀏覽器自動化；使用者登入 NCUE）：發佈至 Web 探測 →
   練習一（含排程更新）→ 練習二 → 練習三。
4. **接線**：iframe 網址或截圖填入 `embeds.js`；README 重寫為作品集說明。
5. **驗收**：live 網站逐頁驗證、排程更新實測、最終截圖存檔。

### 階段 3 前的使用者待辦（帳號層級）

- 登入 app.powerbi.com（NCUE 帳號）供瀏覽器自動化使用。
- （建議）CWA API key 曾在聊天中外洩 — 至 CWA 平台換發後
  `cd worker && npx wrangler secret put CWA_API_KEY` 更新（Cloudflare 登入需本人）。
