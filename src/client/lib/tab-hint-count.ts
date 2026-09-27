/**
 * 下のタブの帯の下に名前を出すか、起動した回数から決める、見た目を持たない計算。issue #239
 * はじめの 3 回だけ出し、4 回目から消す。kota の返し(#227)
 */
export const MAX_HINT_TIMES = 3;

/** これまでの起動の回数から、今回は名前を出すか */
export function shouldShowTabHint(seen: number): boolean {
  return seen < MAX_HINT_TIMES;
}

/** 起動した回数を 1 増やす。3 回に達していれば増やさない(そのまま数え続けない) */
export function nextTabHintCount(seen: number): number {
  return shouldShowTabHint(seen) ? seen + 1 : seen;
}
