/**
 * 行がそのままシートに広がる動き(共有要素)。押した行とシートに同じ view-transition-name
 * ("row-expand")を付け、View Transitions API に位置と大きさをつなげてもらう。0044、0093、issue #241
 *
 * ラボの「新しい見た目」を入れた人だけで使う。呼び出し側が useRowExpandActive() で
 * 使えるかどうかを決め、その結果を useRowExpandTransition に渡す。使えないときは名前を付けず、
 * これまでどおりシートの既定のフェードで開閉する。
 *
 * 行の <li> と ResponsiveSheet は、このファイルの RowExpandContext を通して名前を受け取る。
 * 呼び出し側(TodayPage、KakeiboPage など)から個々の行・シートまで props を通さずに済み、
 * 拡張の Editor コンポーネント(ClientExtension.Editor)の型も変えずに済む。
 */
import { createContext, useCallback, useContext, useState } from "react";
import { flushSync } from "react-dom";
import { useExpandMotionActive } from "@/lib/expand-motion-active";

/** 行 ⇄ シートの共有要素に使う、ただ 1 つの名前。同時に広がる行は 1 つだけなので固定でよい */
export const ROW_EXPAND_NAME = "row-expand";

type RowExpandState = {
  /** いま view-transition-name を持つべき行の key。シートが開いている間は null(シート側が持つ) */
  activeKey: string | null;
  /** シートが持つべき名前。開いていなければ undefined */
  sheetName: string | undefined;
};

const DEFAULT_STATE: RowExpandState = { activeKey: null, sheetName: undefined };

export const RowExpandContext = createContext<RowExpandState>(DEFAULT_STATE);

/** 行の <li> が読む。自分の key が対象なら view-transition-name を付ける */
export function useRowExpandName(key: string): string | undefined {
  const { activeKey } = useContext(RowExpandContext);
  return activeKey === key ? ROW_EXPAND_NAME : undefined;
}

/** ResponsiveSheet が読む。呼び出し側が明にプロパティを渡さなければこちらを使う */
export function useSheetExpandName(): string | undefined {
  return useContext(RowExpandContext).sheetName;
}

/** この端末・この設定で、行 → シートの共有要素の動きを使ってよいか。0044、0093 */
export const useRowExpandActive = useExpandMotionActive;

/**
 * 行を押してシートを開く・シートを閉じるときに呼ぶ。openRow は、行に名前を付ける描画と
 * シートを開く更新を別々の同期の更新に分ける(先に行へ名前を付けてから、
 * View Transitions に「古い見た目」を捉えさせる必要があるため)。
 */
export function useRowExpandTransition(active: boolean) {
  const [transitioningKey, setTransitioningKey] = useState<string | null>(null);

  const openRow = useCallback(
    (key: string, run: () => void) => {
      if (!active) {
        run();
        return;
      }
      // 先に行へ名前を付ける描画を確定させ、次の startViewTransition が「古い見た目」として捉える
      flushSync(() => setTransitioningKey(key));
      document.startViewTransition(() => flushSync(run));
    },
    [active],
  );

  /** シートを閉じた(閉じ始めた)ときに呼ぶ。次に別の行を押すまで、行に名前を付け直さない */
  const resetRowExpand = useCallback(() => setTransitioningKey(null), []);

  return { transitioningKey, openRow, resetRowExpand };
}

/**
 * RowExpandContext.Provider に渡す値を作る。シートが開いていれば、行の名前は消しシートだけが持つ。
 * 閉じていれば、いま押した行だけが名前を持つ。呼び出し側(各画面)が useMemo でくるんで使う
 */
export function rowExpandState(transitioningKey: string | null, sheetOpen: boolean): RowExpandState {
  return {
    activeKey: sheetOpen ? null : transitioningKey,
    sheetName: sheetOpen && transitioningKey !== null ? ROW_EXPAND_NAME : undefined,
  };
}
