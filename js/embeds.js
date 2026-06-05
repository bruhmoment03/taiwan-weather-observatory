// 唯一設定點：所有 Power BI 嵌入與影片設定。
// embedUrl 留空 → 顯示截圖備援（screenshot）＋報表連結（reportLink，可空）。
export const EMBEDS = {
  report1: { title: "報表1 學習平臺使用概況",   embedUrl: "", screenshot: "assets/report1.png", reportLink: "https://app.powerbi.com/groups/2c6378e5-06ea-4a77-8941-5a35f87efbc6/reports/09711e52-408a-4d2b-a942-5429f9d8b1ef" },
  report2: { title: "報表2 學習行為與成績關聯", embedUrl: "", screenshot: "assets/report2.png", reportLink: "https://app.powerbi.com/groups/2c6378e5-06ea-4a77-8941-5a35f87efbc6/reports/819a5d55-f93d-4b6b-a632-aeba10c70618" },
  report3: { title: "報表3 影片學習行為解析",   embedUrl: "", screenshot: "assets/report3.png", reportLink: "https://app.powerbi.com/groups/2c6378e5-06ea-4a77-8941-5a35f87efbc6/reports/a3bc616b-e15e-47b3-aaf7-0bb533de6b24" },
  report4: { title: "報表4 科目與能力難點",     embedUrl: "", screenshot: "assets/report4.png", reportLink: "https://app.powerbi.com/groups/2c6378e5-06ea-4a77-8941-5a35f87efbc6/reports/82e9dfd7-34c5-48c6-9b88-2c2c09300c8d" },
  ex1: { title: "練習一 台灣今明36小時天氣預報", embedUrl: "", screenshot: "assets/ex1.png", reportLink: "" },
  ex2: { title: "練習二 台灣空氣品質監測",       embedUrl: "", screenshot: "assets/ex2.png", reportLink: "" },
  ex3: { title: "練習三 顧客消費資料分析",       embedUrl: "", screenshot: "assets/ex3.png", reportLink: "" },
};

export const VIDEO_ID = ""; // YouTube 影片 ID，錄好後填入

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");

export function embedHtml(cfg) {
  if (cfg.embedUrl) {
    return `<iframe title="${esc(cfg.title)}" src="${esc(cfg.embedUrl)}" allowfullscreen="true"></iframe>`;
  }
  const link = cfg.reportLink
    ? `<p class="embed-note"><a href="${esc(cfg.reportLink)}" target="_blank" rel="noopener">在 Power BI 開啟互動報表 ↗</a></p>`
    : "";
  return `<img src="${cfg.screenshot}" alt="${esc(cfg.title)} 截圖">${link}` +
    `<p class="embed-note">目前顯示報表截圖（互動嵌入待「發佈至 Web」權限開放）。</p>`;
}

export function videoHtml(id) {
  if (!id) return `<p class="embed-note">解說影片連結待補。</p>`;
  return `<iframe src="https://www.youtube.com/embed/${esc(id)}" title="解說影片" allowfullscreen></iframe>`;
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
