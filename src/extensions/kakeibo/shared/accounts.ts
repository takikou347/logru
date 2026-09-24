/** 口座の種類。現金、銀行、カード、電子マネー、その他の固定。0069、F-309 */
export const KAKEIBO_ACCOUNT_KINDS = [
  { key: "cash", label: "現金" },
  { key: "bank", label: "銀行" },
  { key: "card", label: "カード" },
  { key: "emoney", label: "電子マネー" },
  { key: "other", label: "その他" },
] as const;

/** 口座の種類の ID */
export type KakeiboAccountKind = (typeof KAKEIBO_ACCOUNT_KINDS)[number]["key"];

/** zod の enum や、Drizzle の enum 列にそのまま渡せる形 */
export const KAKEIBO_ACCOUNT_KIND_KEYS = KAKEIBO_ACCOUNT_KINDS.map((k) => k.key) as [
  KakeiboAccountKind,
  ...KakeiboAccountKind[],
];

/** 口座の種類の日本語のラベル。知らない ID なら、その ID をそのまま返す */
export function kakeiboAccountKindLabel(key: string): string {
  return KAKEIBO_ACCOUNT_KINDS.find((k) => k.key === key)?.label ?? key;
}
