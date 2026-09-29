/**
 * 節の見出し・機能のタイルを押すと、その面がそのまま機能の画面に広がる動き(共有要素)。0044、0093、issue #241
 *
 * 押した要素に直に view-transition-name を付け(React の外、DOM に直接)、行き先の画面
 * (AppLayout の Page)が同じ名前を自分の面に付ける。React の state ではなくモジュール変数で
 * 合図を渡す。state にすると、行き先の画面の最初の描画までに React の更新をもう 1 回はさみ、
 * View Transitions が「古い見た目」を捉えるタイミング(startViewTransition を呼んだ瞬間の DOM)に
 * 間に合わない。
 *
 * 「戻る」側は、この PR では対象に含めない。行き先の画面の面は、いる間ずっと名前を持ち続けるので
 * 害はないが、戻るボタンは前の画面の記録(#70)を通じて history を辿るだけの作りで、
 * navigate に viewTransition を渡せる形になっていない。困ること、issue #241 のコメント
 */
import { useExpandMotionActive } from "@/lib/expand-motion-active";

const NAME = "box-expand";

export const BOX_EXPAND_NAME = NAME;

let pending = false;

/** 節の見出し・機能のタイルを押した瞬間に呼ぶ。要素に名前を付け、行き先が読む合図を立てる */
export function markBoxExpandSource(el: HTMLElement): void {
  el.style.viewTransitionName = NAME;
  pending = true;
}

/**
 * 機能の画面(Page)が、自分の面に名前を付けるべきかを 1 度だけ読む。マウントの最初の描画で呼ぶ。
 * 読んだら合図を消す。ラボの「新しい見た目」を入れていない・PC・動きを減らす設定のときは
 * 呼び出し側がそもそも呼ばない(合図は次に box-expand で押されるまで残るだけで、害は無い)
 */
export function consumeBoxExpandTarget(): boolean {
  const v = pending;
  pending = false;
  return v;
}

/** この端末・この設定で、節・タイル → 機能の画面の共有要素の動きを使ってよいか。0044、0093 */
export const useBoxExpandActive = useExpandMotionActive;
