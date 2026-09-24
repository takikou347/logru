/** 家計簿のカテゴリ。支出 15、収入 4 の固定。足し方と並べ替えは使ってから考える。0069 */
export const KAKEIBO_EXPENSE_CATEGORIES = [
  { key: "food", label: "食費" },
  { key: "dining_out", label: "外食" },
  { key: "daily_goods", label: "日用品" },
  { key: "transport", label: "交通" },
  { key: "housing", label: "住まい" },
  { key: "utilities", label: "水道光熱" },
  { key: "communication", label: "通信" },
  { key: "medical", label: "医療" },
  { key: "clothing", label: "服と美容" },
  { key: "hobby", label: "趣味" },
  { key: "social", label: "交際" },
  { key: "education", label: "教育" },
  { key: "insurance", label: "保険" },
  { key: "tax", label: "税と社会保険" },
  { key: "other", label: "その他" },
] as const;

/** 収入のカテゴリ。0069 */
export const KAKEIBO_INCOME_CATEGORIES = [
  { key: "salary", label: "給料" },
  { key: "bonus", label: "賞与" },
  { key: "side_income", label: "副業" },
  { key: "other_income", label: "その他の収入" },
] as const;

/** 支出のカテゴリの ID */
export type KakeiboExpenseCategory = (typeof KAKEIBO_EXPENSE_CATEGORIES)[number]["key"];
/** 収入のカテゴリの ID */
export type KakeiboIncomeCategory = (typeof KAKEIBO_INCOME_CATEGORIES)[number]["key"];
/** 振替の記録にも category の列を使うので、`transfer` も型に含める */
export type KakeiboCategory = KakeiboExpenseCategory | KakeiboIncomeCategory | "transfer";

/** zod の enum や、Drizzle の enum 列にそのまま渡せる形 */
export const KAKEIBO_EXPENSE_CATEGORY_KEYS = KAKEIBO_EXPENSE_CATEGORIES.map((c) => c.key) as [
  KakeiboExpenseCategory,
  ...KakeiboExpenseCategory[],
];
export const KAKEIBO_INCOME_CATEGORY_KEYS = KAKEIBO_INCOME_CATEGORIES.map((c) => c.key) as [
  KakeiboIncomeCategory,
  ...KakeiboIncomeCategory[],
];
/** DB の enum 列にそのまま渡せる、支出・収入・振替を合わせた形 */
export const KAKEIBO_CATEGORY_KEYS = [
  ...KAKEIBO_EXPENSE_CATEGORY_KEYS,
  ...KAKEIBO_INCOME_CATEGORY_KEYS,
  "transfer",
] as [KakeiboCategory, ...KakeiboCategory[]];

/** カテゴリの日本語のラベル。知らない ID なら、その ID をそのまま返す */
export function kakeiboCategoryLabel(key: string): string {
  return (
    KAKEIBO_EXPENSE_CATEGORIES.find((c) => c.key === key)?.label ??
    KAKEIBO_INCOME_CATEGORIES.find((c) => c.key === key)?.label ??
    key
  );
}

/** 支出のカテゴリか */
export function isExpenseCategory(key: string): key is KakeiboExpenseCategory {
  return (KAKEIBO_EXPENSE_CATEGORY_KEYS as readonly string[]).includes(key);
}

/** 収入のカテゴリか */
export function isIncomeCategory(key: string): key is KakeiboIncomeCategory {
  return (KAKEIBO_INCOME_CATEGORY_KEYS as readonly string[]).includes(key);
}
