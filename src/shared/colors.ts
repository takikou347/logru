// 色は名前で持つ。値はライトとダークで CSS の側が決める
export const GROUP_COLORS = [
  { key: "wakatake", label: "若竹" },
  { key: "yamabuki", label: "山吹" },
  { key: "asagi", label: "浅葱" },
  { key: "toki", label: "朱鷺" },
  { key: "fuji", label: "藤" },
  { key: "kaki", label: "柿" },
  { key: "moegi", label: "萌黄" },
  { key: "nezumi", label: "鼠" },
] as const;

export const ACCENT_COLORS = [
  { key: "aizumi", label: "藍墨" },
  { key: "fukamidori", label: "深緑" },
  { key: "kon", label: "紺" },
  { key: "beni", label: "紅" },
  { key: "kogecha", label: "焦茶" },
] as const;

export type GroupColor = (typeof GROUP_COLORS)[number]["key"];
export type AccentColor = (typeof ACCENT_COLORS)[number]["key"];

export const GROUP_COLOR_KEYS = GROUP_COLORS.map((c) => c.key) as [GroupColor, ...GroupColor[]];
export const ACCENT_COLOR_KEYS = ACCENT_COLORS.map((c) => c.key) as [AccentColor, ...AccentColor[]];

/** 使われていない色のうち、並びの最初のものを返す。すべて使われていれば順に回す */
export function pickUnusedColor(used: readonly string[]): GroupColor {
  const free = GROUP_COLOR_KEYS.find((k) => !used.includes(k));
  if (free) return free;
  return GROUP_COLOR_KEYS[used.length % GROUP_COLOR_KEYS.length]!;
}
