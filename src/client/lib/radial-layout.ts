/**
 * 「+」の放射(RadialAddButton)の弧の位置を決める、見た目を持たない計算。issue #239
 *
 * 5 個までは半径 128px の弧 1 本。6 個以上は内側(半径 100px)に 4 つ、外側(半径 176px)に
 * 残りを置き、弧を 2 重にする(案 A3)。
 */

export type RadialTier<T> = { items: T[]; radius: number };

const SINGLE_ARC_RADIUS = 128;
const INNER_ARC_RADIUS = 100;
const OUTER_ARC_RADIUS = 176;
const INNER_ARC_MAX = 4;
const DOUBLE_ARC_THRESHOLD = 6;

/** 弧の組。1 本か、6 個以上なら内・外の 2 本 */
export function radialTiers<T>(items: T[]): RadialTier<T>[] {
  if (items.length >= DOUBLE_ARC_THRESHOLD) {
    return [
      { items: items.slice(0, INNER_ARC_MAX), radius: INNER_ARC_RADIUS },
      { items: items.slice(INNER_ARC_MAX), radius: OUTER_ARC_RADIUS },
    ];
  }
  return [{ items, radius: SINGLE_ARC_RADIUS }];
}

/**
 * 弧に並べる角度(度)。0° が右、90° が真上。1 個だけの弧は真上に置く。
 * 親指に近い右寄りから(165°)左寄り(15°)へ、等間隔に並べる
 */
export function angleOf(index: number, total: number): number {
  if (total <= 1) return 90;
  const start = 165;
  const end = 15;
  return start + (index / (total - 1)) * (end - start);
}

/** 角度と半径から、中心からの (x, y) のずれ(px)。y は上がマイナス */
export function radialOffset(angle: number, radius: number): { x: number; y: number } {
  const rad = (angle * Math.PI) / 180;
  return { x: Math.cos(rad) * radius, y: -Math.sin(rad) * radius };
}
