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
