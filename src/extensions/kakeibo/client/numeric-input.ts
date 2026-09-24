/**
 * 金額の入力欄で、数字以外を弾く。`type="number"` はスピナー(上下の矢印)が出て、PC ではホイールで値が
 * 変わってしまうため、金額の欄は `type="text"` と `inputMode="numeric"` にし、ここで数字だけに絞る。
 * 日本語の入力で全角の数字やマイナスが来ても、半角に直してから絞る。
 * @param allowNegative マイナスを許すか。許すときは先頭の 1 文字だけ「-」を通す
 */
export function sanitizeAmountInput(value: string, allowNegative = false): string {
  const half = value.normalize("NFKC").replace(/[−ー―‐]/g, "-");
  const digits = half.replace(/[^0-9]/g, "");
  if (!allowNegative) return digits;
  return half.trimStart().startsWith("-") ? `-${digits}` : digits;
}
