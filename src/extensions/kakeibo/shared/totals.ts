import { KAKEIBO_CATEGORY_KEYS, type KakeiboCategory } from "./categories";

/** 合計を数えるのに要る、記録の最小限の形 */
type Amounted = { category: KakeiboCategory; amount: number };

/** 記録の金額をすべて足す */
export function sumAmount(rows: Pick<Amounted, "amount">[]): number {
  return rows.reduce((n, r) => n + r.amount, 0);
}

/**
 * カテゴリごとの合計を数える。F-303
 * 記録が無いカテゴリも 0 で返し、画面が 6 件すべてを並べられるようにする。
 * @param rows 数える記録
 */
export function summarizeByCategory(rows: Amounted[]): { category: KakeiboCategory; total: number }[] {
  return KAKEIBO_CATEGORY_KEYS.map((category) => ({
    category,
    total: sumAmount(rows.filter((r) => r.category === category)),
  }));
}
