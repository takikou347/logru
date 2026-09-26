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

/** 記録・予算・定期の記録・精算の金額の上限。1 億円。0081 */
export const KAKEIBO_AMOUNT_MAX = 100_000_000;

/**
 * 金額の入力欄の値が正しいか。1 円から {@link KAKEIBO_AMOUNT_MAX} までの整数であること。
 * 記録、予算、定期の記録、精算の 4 か所で同じ式だったのをここへ集める。issue #207
 */
export function isValidKakeiboAmount(text: string): boolean {
  const value = Number(text);
  return text !== "" && Number.isInteger(value) && value > 0 && value <= KAKEIBO_AMOUNT_MAX;
}
