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
