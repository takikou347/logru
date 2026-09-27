/** 動きを減らす設定かどうかを、その場で確かめる。読めない環境では false。0044 */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}
