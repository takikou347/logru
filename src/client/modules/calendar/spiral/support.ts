/**
 * 3D で描けるかの見分け方。0051
 * WebGL が使えない、または動きを減らす設定のときは、平らな年の表にする
 */

/** `useMediaQuery` に渡すクエリ */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** canvas から context を取れる最小限の形。テストでは差し替えて確かめる */
type CanvasLike = { getContext: (id: string) => unknown };

/**
 * WebGL が使えるか。`document.createElement("canvas")` から webgl2 か webgl の context を取れるかで見分ける。
 * @param createCanvas canvas を作る関数。既定は本物の canvas 要素
 */
export function supportsWebGL(createCanvas: () => CanvasLike = () => document.createElement("canvas")): boolean {
  try {
    const canvas = createCanvas();
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
