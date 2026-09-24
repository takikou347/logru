import { KAKEIBO_EXPENSE_CATEGORY_KEYS, type KakeiboCategory } from "./categories";
import type { KakeiboType } from "./types";

/** 合計を数えるのに要る、記録の最小限の形 */
type Amounted = { type: KakeiboType; category: KakeiboCategory; amount: number };

/** 渡された記録の金額をすべて足す。カレンダーの日ごとの合計など、種類を絞った後の並びで使う */
export function sumAmount(rows: { amount: number }[]): number {
  return rows.reduce((n, r) => n + r.amount, 0);
}

/** ある種類の記録の金額をすべて足す。振替は支出にも収入にも数えない。0069 */
export function sumByType(rows: Pick<Amounted, "type" | "amount">[], type: KakeiboType): number {
  return rows.filter((r) => r.type === type).reduce((n, r) => n + r.amount, 0);
}

/**
 * 支出のカテゴリごとの合計を、記録のあるものだけ、多い順で返す。F-303
 * @param rows 数える記録
 */
export function summarizeExpenseByCategory(
  rows: Pick<Amounted, "type" | "category" | "amount">[],
): { category: KakeiboCategory; total: number }[] {
  return KAKEIBO_EXPENSE_CATEGORY_KEYS.map((category) => ({
    category,
    total: rows.filter((r) => r.type === "expense" && r.category === category).reduce((n, r) => n + r.amount, 0),
  }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
}
