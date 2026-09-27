/** 端末を短く震わせる合図。0044、0048、#112 */

/** 震える長さ(ms)。長押しの合図(MonthGrid、10ms)より少し長く、うるさくない範囲 */
const SHORT_MS = 15;

/**
 * 短く震える。`navigator.vibrate` が使える端末だけ。動きを減らしているときは鳴らさない。
 * 予定を足したとき、いいねを押したときに呼ぶ。#112
 */
export function vibrateShort(): void {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  navigator.vibrate(SHORT_MS);
}
