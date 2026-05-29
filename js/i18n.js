// Shared Chinese (繁體) labels. Region keys stay English in the data; these map
// them to display text. Centralised so every view stays consistent.

export const REGION_ZH = {
  North: "北部",
  Central: "中部",
  South: "南部",
  East: "東部",
  Islands: "離島",
};

export const regionLabel = (key) => REGION_ZH[key] || key;
