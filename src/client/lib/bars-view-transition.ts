/**
 * 行 → シート・節 → 機能の画面が広がる間、上の帯・下のタブの帯を動かさずそのまま見せる。0044、0093、issue #241
 *
 * 名前を付けていないと、これらの帯は View Transitions の「root」の一部として写し取られる。
 * root は 0071 で動きを止めてあるが、広がる名前付きの面(row-expand、box-expand)がこの帯の上に
 * 重なって描かれ、薄れたりずれたりして見えることがあった。帯にも個別の名前を付け、globals.css の
 * 節(`::view-transition-*(nl-topbar)`、`(nl-dock)`)で root と同じく動きを止め、
 * 広がる面より前面に描かれる `z-index` を明にする。issue #241 の kota の指摘、2026-09-27
 */
import { useExpandMotionActive } from "@/lib/expand-motion-active";

export const NL_TOPBAR_NAME = "nl-topbar";
export const NL_DOCK_NAME = "nl-dock";

/** 上の帯(ページ自身のヘッダー、PageBar)が読む */
export function useTopBarViewTransitionStyle(): { viewTransitionName: string } | undefined {
  const active = useExpandMotionActive();
  return active ? { viewTransitionName: NL_TOPBAR_NAME } : undefined;
}

/** 下のタブの帯(GlobalBottomTabs)が読む */
export function useDockViewTransitionStyle(): { viewTransitionName: string } | undefined {
  const active = useExpandMotionActive();
  return active ? { viewTransitionName: NL_DOCK_NAME } : undefined;
}
