/**
 * View Transitions API で画面の更新を包む。月・週・日を切り替えたとき、選んだ日のマスが
 * 次の表の見出しへつながって見えるようにするのに使う。0049、#100
 */
import { flushSync } from "react-dom";

/**
 * 対応していないブラウザと、動きを減らしているときは、これまでどおり run() を呼ぶだけにする。
 * @param reducedMotion 端末が動きを減らす設定にしているか
 * @param run 画面を更新する処理。View Transitions が使えるときは、この中の状態の変更を
 *   同期で終わらせてから、古い見た目と新しい見た目をつなげて動かす
 */
export function withViewTransition(reducedMotion: boolean, run: () => void): void {
  if (reducedMotion || typeof document === "undefined" || !("startViewTransition" in document)) {
    run();
    return;
  }
  document.startViewTransition(() => flushSync(run));
}
