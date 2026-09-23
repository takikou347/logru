/**
 * らせんの形の計算。three.js に依存しない、素の数だけを返す。0051
 * 1 年で 1 周だけ回るらせん。1 月 1 日が底、12 月 31 日が上。半径は変えない
 */

export type SpiralPoint = { x: number; y: number; z: number; angle: number };

/**
 * 年の中の日の番号から、らせんの上の位置を返す。
 * @param index 0 から始まる、年の中の日の番号
 * @param total その年の日数。365 か 366
 * @param radius らせんの半径
 * @param height らせんの高さ。原点を中心に、上下に半分ずつ伸びる
 */
export function spiralPoint(index: number, total: number, radius: number, height: number): SpiralPoint {
  const t = total <= 1 ? 0 : index / total;
  const angle = t * Math.PI * 2;
  return {
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius,
    y: t * height - height / 2,
    angle,
  };
}
