/**
 * 「+」の放射(RadialAddButton)の弧の位置を決める、見た目を持たない計算。issue #239
 *
 * 5 個までは半径 128px の弧 1 本。6 個以上は内側(半径 104px)に 4 つ、外側(半径 176px)に
 * 残りを置き、弧を 2 重にする(案 A3)。
 *
 * 弧の両端の角度は、丸(直径 48px)が下のタブの帯に重ならず、幅 360px の画面の端からも
 * はみ出さないように、弧ごとに決める。どの丸も「+」の中心から 64px 以上、上に置く
 * (帯の高さの半分 32px + 丸の半径 24px + すき間 8px)。0091
 */

export type RadialTier<T> = { items: T[]; radius: number; from: number; to: number };

const SINGLE_ARC = { radius: 128, from: 150, to: 30 };
const INNER_ARC = { radius: 104, from: 140, to: 40 };
const OUTER_ARC = { radius: 176, from: 145, to: 35 };
const INNER_ARC_MAX = 4;
const DOUBLE_ARC_THRESHOLD = 6;

/** 弧の丸の直径(px)。RadialAddButton の丸(size-12)と同じ */
export const RADIAL_ITEM_SIZE = 48;

/** 弧の組。1 本か、6 個以上なら内・外の 2 本 */
export function radialTiers<T>(items: T[]): RadialTier<T>[] {
  if (items.length >= DOUBLE_ARC_THRESHOLD) {
    return [
      { items: items.slice(0, INNER_ARC_MAX), ...INNER_ARC },
      { items: items.slice(INNER_ARC_MAX), ...OUTER_ARC },
    ];
  }
  return [{ items, ...SINGLE_ARC }];
}

/**
 * 弧に並べる角度(度)。0° が右、90° が真上。1 個だけの弧は真上に置く。
 * 左寄り(from)から右寄り(to)へ、等間隔に並べる
 */
export function angleOf(index: number, total: number, from = SINGLE_ARC.from, to = SINGLE_ARC.to): number {
  if (total <= 1) return 90;
  return from + (index / (total - 1)) * (to - from);
}

/** 角度と半径から、中心からの (x, y) のずれ(px)。y は上がマイナス */
export function radialOffset(angle: number, radius: number): { x: number; y: number } {
  const rad = (angle * Math.PI) / 180;
  return { x: Math.cos(rad) * radius, y: -Math.sin(rad) * radius };
}

/** よく使う記録のカードの帯を置く高さ。いちばん外の弧の丸の上端から 12px 空ける */
export function favoritesOffset<T>(tiers: RadialTier<T>[]): number {
  const outer = tiers.at(-1);
  if (!outer) return SINGLE_ARC.radius + RADIAL_ITEM_SIZE / 2 + 12;
  const top = Math.max(
    ...outer.items.map((_, i) => -radialOffset(angleOf(i, outer.items.length, outer.from, outer.to), outer.radius).y),
  );
  return top + RADIAL_ITEM_SIZE / 2 + 12;
}
