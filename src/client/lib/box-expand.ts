/**
 * 節の見出し・機能のタイルを押すと、その面がそのまま機能の画面に広がる動き(共有要素)。0044、0093、issue #241
 *
 * 押した要素に直に view-transition-name を付け(React の外、DOM に直接)、行き先の画面
 * (AppLayout の Page)が同じ名前を自分の面に付ける。React の state ではなくモジュール変数で
 * 合図を渡す。state にすると、行き先の画面の最初の描画までに React の更新をもう 1 回はさみ、
 * View Transitions が「古い見た目」を捉えるタイミング(startViewTransition を呼んだ瞬間の DOM)に
 * 間に合わない。
 *
 * 「戻る」(issue #311)は、押した要素の key と行き先のパスをここに覚えておき、戻るボタン(useBack)が
 * navigate(-n) を document.startViewTransition で包む。react-router の navigate(delta) は
 * viewTransition を持てないため、自分で包む。戻った先に同じ key の要素(data-box-source)が
 * あるときだけ、その要素に名前を付けて縮んで戻す。無ければ今までどおり切り替わるだけ。
 * ブラウザーの戻る(端からのスワイプ)は popstate の時点で古い見た目を捉えられないので対象外
 */
import { useExpandMotionActive } from "@/lib/expand-motion-active";

const NAME = "box-expand";

export const BOX_EXPAND_NAME = NAME;

let pending = false;

/** 押した要素の key(data-box-source の値)、押した画面と行き先のパス。戻るときに使う */
let source: { key: string; fromPath: string; toPath: string } | null = null;

/**
 * 節の見出し・機能のタイルを押した瞬間に呼ぶ。要素に名前を付け、行き先が読む合図を立てる
 * @param key 戻ったとき、同じ要素を data-box-source で探すための値
 * @param toPath 行き先のパス
 */
export function markBoxExpandSource(el: HTMLElement, key: string, toPath: string): void {
  el.style.viewTransitionName = NAME;
  pending = true;
  source = { key, fromPath: window.location.pathname, toPath };
}

/** 戻る先のパスが押した画面で、いまが行き先の画面なら、押した要素の key を返す。違えば null */
export function boxExpandReturnKey(currentPath: string, targetPath: string): string | null {
  if (!source || source.toPath !== currentPath || source.fromPath !== targetPath) return null;
  // 行き先の面が名前を持っていないとき(別の道で開き直した画面)は動かさない
  if (!document.querySelector(`[data-box-page][style*="${NAME}"]`)) return null;
  return source.key;
}

/** 戻った先で、押した要素に名前を付ける。見つからなければ false(今までどおり切り替わるだけ) */
export function applyBoxExpandReturn(key: string): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(`[data-box-source="${CSS.escape(key)}"]`);
  if (el) el.style.viewTransitionName = NAME;
  return el;
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
