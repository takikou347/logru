/** 端末を短く震わせる合図。0044、0048、#112 */

/** 震える長さ(ms)。うるさくない範囲 */
const SHORT_MS = 15;
/** 長押しの合図の長さ(ms)。短い震えより少し短い。#278 */
const TICK_MS = 10;

function vibrate(ms: number): void {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  navigator.vibrate(ms);
}

/**
 * 短く震える。`navigator.vibrate` が使える端末だけ。動きを減らしているときは鳴らさない。
 * 予定を足したとき、いいねを押したときに呼ぶ。#112
 */
export function vibrateShort(): void {
  vibrate(SHORT_MS);
}

/** 月の長押しが効いた合図の、ごく短い震え(10ms)。動きを減らしているときと非対応端末では何もしない。#278 */
export function vibrateTick(): void {
  vibrate(TICK_MS);
}
