/**
 * 金額を `¥1,200` の形に整える。マイナスは `-¥1,200` にする。カードの残高など、マイナスを許す値で使う。
 * 画面とカレンダーの項目の題名の両方で使う
 */
export function formatYen(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}¥${Math.abs(amount).toLocaleString("ja-JP")}`;
}

/** 収入の行で使う、符号付きの金額。`+¥1,200` の形にする。F-303 */
export function formatSignedYen(amount: number): string {
  return amount < 0 ? formatYen(amount) : `+${formatYen(amount)}`;
}
