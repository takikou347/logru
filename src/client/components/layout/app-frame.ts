/**
 * 画面が AppShell に伝える外枠の値。0071
 *
 * AppShell.tsx から分けているのは、GlobalBottomTabs(Dock.tsx)がこの値の「+」(addables)だけを
 * 読むためだけに AppShell.tsx を読み込むと、Dock → AppShell → Dock の循環になるため。0091
 */
import { createContext, type ReactNode, useContext, useLayoutEffect } from "react";
import type { Addable } from "@/components/parts/PrimaryAddButton";

export type AppFrame = {
  poolColors: string[];
  poolFocus?: number | null;
  side?: ReactNode;
  /**
   * 新しい見た目・スマホでは、下のタブの帯の「+」がこれを放射で出す。渡さない画面(設定、
   * グループなど)では、放射に出すものが無い(決定 0086 と同じ扱い)。0091、issue #239
   */
  addables?: Addable[];
};

export const emptyFrame: AppFrame = { poolColors: [] };

export const SetAppFrameContext = createContext<((frame: AppFrame) => void) | null>(null);
export const FrameContext = createContext<AppFrame>(emptyFrame);

/**
 * ログイン後の画面が、外枠(インクだまりの色、PC の左の列に足すもの、下のタブの「+」)を
 * AppShell へ伝える。画面を移っても外枠を作り直さないよう、AppShell をログイン後の画面の親の
 * ルートに 1 つだけ置き、各画面は値だけをここで渡す。0071、0091
 *
 * `useLayoutEffect` を使うのは、色や side が 1 描画分でも初期値(既定の色、空)のまま
 * 塗られてちらつかないようにするため。
 *
 * @param poolColors インクだまりの 3 色
 * @param poolFocus 膨らませる色の番号
 * @param side PC の左の列に足すもの。カレンダーはグループの絞り込みを置く。多いときは、この欄だけが流れる。F-25
 * @param addables 新しい見た目・スマホの下のタブの「+」に渡す、この画面の足せるもの
 */
export function useAppFrame({ poolColors, poolFocus, side, addables }: AppFrame) {
  const setFrame = useContext(SetAppFrameContext);
  useLayoutEffect(() => {
    setFrame?.({ poolColors, poolFocus, side, addables });
    // 画面を離れるとき既定へ戻す。次の画面が呼び忘れても、前の画面の色や side、addables が残らないようにする
    return () => setFrame?.(emptyFrame);
  }, [setFrame, poolColors, poolFocus, side, addables]);
}

/** いま開いている画面が渡した addables。渡していなければ空(下のタブの「+」は出ない)。0091 */
export function useAppFrameAddables(): Addable[] {
  return useContext(FrameContext).addables ?? [];
}
