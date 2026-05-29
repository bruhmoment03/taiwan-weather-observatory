// Holds the Power BI "Publish to web" URL and renders it into #pbi-slot.
// Set EMBED_URL after publishing the report:
//   Power BI Service -> open report -> File -> Embed report -> Publish to web (public)
//   -> copy the https://app.powerbi.com/view?r=... value from the iframe src.
export const EMBED_URL = ""; // e.g. "https://app.powerbi.com/view?r=eyJrIjoi..."

export function renderEmbed(url = EMBED_URL) {
  const slot = document.getElementById("pbi-slot");
  if (!slot) return;
  if (!url) {
    slot.innerHTML = `
      <div class="pending">
        <h2>報表發布中 · Report publishing</h2>
        <p>The Power BI report is being published to the web. The live dashboard will appear here once the embed link is connected.</p>
      </div>`;
    return;
  }
  slot.innerHTML = `<iframe title="Taiwan Weather Power BI dashboard"
      src="${url}" frameborder="0" allowfullscreen="true"></iframe>`;
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => renderEmbed());
}
