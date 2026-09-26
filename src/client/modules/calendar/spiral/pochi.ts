/**
 * インクのしずくの「ぽつ」が、らせんの上を今日の日まで転がる動きの計算。0075、F-42
 * three.js に依存しない、素の数だけを返す。見た目のラボの裏でだけ出す。0039
 */

/** 転がり切るまでの時間(ミリ秒) */
export const POCHI_ROLL_MS = 2200;

/**
 * 転がりの経過を 0(1 月 1 日)から 1(今日の日)で返す。
 * 動きを減らす設定のときは、常に 1 を返し、最初から今日の位置に置く。
 * @param elapsedMs シーンを開いてからの経過時間
 * @param reducedMotion 動きを減らす設定かどうか
 */
export function pochiProgress(elapsedMs: number, reducedMotion: boolean): number {
  if (reducedMotion) return 1;
  const t = Math.min(1, Math.max(0, elapsedMs / POCHI_ROLL_MS));
  // ease-out。転がるほど遅くなり、今日の位置でぴたりと止まる
  return 1 - (1 - t) ** 3;
}
