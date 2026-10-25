/**
 * 「‹」で戻る先を、前に表示していた画面にする仕組み。0070
 *
 * パスが変わるたびに、react-router が history.state に積む idx(ブラウザーの戻ると同じ番号)と
 * 一緒に記録する。絞り込みやシートの開閉で `?` だけ変わるもの(多くは replace で移る)は、
 * パスが同じなら記録を増やさず idx だけ書き換える。「‹」を押すと、いまと違うパスで、いまより
 * 前の idx を記録から探し、その分だけ history.go で戻る。見つからなければ fallback へ push する。
 *
 * 記録はモジュールの変数に持つ。再読み込みするとここもリセットされ、直に開いたとき(共有の
 * リンクから来た、URL を直に打ったなど)と同じ扱いになる。
 */
import type { MouseEvent } from "react";
import { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { applyBoxExpandReturn, boxExpandReturnKey, useBoxExpandActive } from "@/lib/box-expand";

type ScreenEntry = { idx: number; pathname: string };

/** history.state から react-router の idx を読む。積んでいなければ null */
function historyIdx(): number | null {
  const state = window.history.state as { idx?: number } | null | undefined;
  return typeof state?.idx === "number" ? state.idx : null;
}

const screenStack: ScreenEntry[] = [];

/** 戻る動き(View Transition)の中で、戻り先の画面が描画されるのを待っている resolve。issue #311 */
let screenReady: (() => void) | null = null;

function recordScreen(pathname: string) {
  const idx = historyIdx();
  if (idx === null) return;
  const top = screenStack[screenStack.length - 1];
  if (top && top.pathname === pathname) {
    // 同じ画面のまま `?` だけ変わった。記録は増やさず idx だけ更新する
    top.idx = idx;
    return;
  }
  // ブラウザーの戻る、直す(replace)で来たときは、それより新しい記録を切り捨てる
  while (screenStack.length > 0 && screenStack[screenStack.length - 1]!.idx >= idx) {
    screenStack.pop();
  }
  screenStack.push({ idx, pathname });
}

/**
 * いまの画面を、戻るための記録に積む。戻るボタンを持たない画面(カレンダーなど)でも、
 * ほかの画面から「‹」で正しく戻れるよう、画面ごとに 1 度呼ぶ。useBack は内側でこれを呼ぶので、
 * 戻るボタンがある画面はこちらを別に呼ばなくてよい。
 */
export function useRecordScreen(): void {
  const { pathname } = useLocation();
  useEffect(() => {
    recordScreen(pathname);
    // 戻る動きを待っているなら、戻り先の画面が描画された(DOM が揃った)ので続きを通す
    const ready = screenReady;
    screenReady = null;
    ready?.();
  }, [pathname]);
}

/**
 * 戻るボタン(PageBar、BackLink など)が呼ぶ。
 * @param fallback 前の画面の記録が無いときに移る、決まった先
 * @returns to は fallback(右クリックで新しいタブに開く、非 JS でも動く実の行き先)。
 *   onClick は、前の画面の記録があればそこへ history を戻り、無ければ fallback へ push する
 */
export function useBack(fallback: string): { to: string; onClick: (e?: MouseEvent) => void } {
  useRecordScreen();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const boxExpandActive = useBoxExpandActive();

  /**
   * navigate(delta) を、押した節・タイルへ縮んで戻る動きで包む。issue #311
   * navigate(delta) は history.go で非同期に画面が替わるため、View Transition の更新関数が
   * 戻り先の描画を待つ Promise を返し、描画後に押した要素へ名前を付ける。無ければ素の navigate
   */
  const goWithMotion = useCallback(
    (delta: number, targetPath: string) => {
      const key = boxExpandActive ? boxExpandReturnKey(pathname, targetPath) : null;
      if (key === null) {
        navigate(delta);
        return;
      }
      const transition = document.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            const timer = window.setTimeout(done, 600);
            function done() {
              window.clearTimeout(timer);
              screenReady = null;
              applyBoxExpandReturn(key!);
              resolve();
            }
            screenReady = done;
            navigate(delta);
          }),
      );
      // 動きが終わったら名前を外す(次に別の動きの邪魔をしない)
      void transition.finished.finally(() => {
        const el = document.querySelector<HTMLElement>(`[data-box-source="${CSS.escape(key)}"]`);
        if (el) el.style.viewTransitionName = "";
      });
    },
    [boxExpandActive, navigate, pathname],
  );

  const onClick = useCallback(
    (e?: MouseEvent) => {
      e?.preventDefault();
      const idx = historyIdx();
      if (idx !== null) {
        for (let i = screenStack.length - 1; i >= 0; i--) {
          const entry = screenStack[i]!;
          if (entry.idx < idx && entry.pathname !== pathname) {
            goWithMotion(-(idx - entry.idx), entry.pathname);
            return;
          }
        }
      }
      navigate(fallback);
    },
    [fallback, goWithMotion, navigate, pathname],
  );

  return { to: fallback, onClick };
}
