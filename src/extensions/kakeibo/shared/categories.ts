/** 家計簿のカテゴリ。最初の版は 6 つの固定で、増やすのは使ってから考える。F-301 */
export const KAKEIBO_CATEGORIES = [
  { key: "food", label: "食費" },
  { key: "daily_goods", label: "日用品" },
  { key: "transport", label: "交通" },
  { key: "dining_out", label: "外食" },
  { key: "hobby", label: "趣味" },
  { key: "other", label: "その他" },
] as const;

/** カテゴリの ID */
export type KakeiboCategory = (typeof KAKEIBO_CATEGORIES)[number]["key"];

/** zod の enum や、Drizzle の enum 列にそのまま渡せる形 */
export const KAKEIBO_CATEGORY_KEYS = KAKEIBO_CATEGORIES.map((c) => c.key) as [KakeiboCategory, ...KakeiboCategory[]];

/** カテゴリの日本語のラベル。知らない ID なら、その ID をそのまま返す */
export function kakeiboCategoryLabel(key: string): string {
  return KAKEIBO_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}
