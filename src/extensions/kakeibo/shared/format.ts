/** 金額を `¥1,200` の形に整える。画面とカレンダーの項目の題名の両方で使う */
export function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}
