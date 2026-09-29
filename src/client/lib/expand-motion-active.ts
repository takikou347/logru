/**
 * 行 → シート、節・タイル → 機能の画面の共有要素の動き(view-transition-name を使う動き)を
 * この端末・この設定で使ってよいか。row-expand.ts と box-expand.ts の両方が使う共通の条件。
 * 0044、0093、issue #241
 *
 * ラボの「新しい見た目」を入れ、PC でなく、動きを減らしておらず、View Transitions API が使える人だけ true
 */
import { useNewLookActive } from "@/lib/lab";
import { useMediaQuery } from "@/lib/use-media-query";

export function useExpandMotionActive(): boolean {
  const newLook = useNewLookActive();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const supported = typeof document !== "undefined" && "startViewTransition" in document;
  return newLook && !desktop && !reducedMotion && supported;
}
