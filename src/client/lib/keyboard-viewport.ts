import { useEffect, useState } from "react";

/**
 * OS のソフトウェアキーボードが出ているとみなす、`visualViewport` の縮み幅(px)の下限。0094、issue #242
 *
 * ブラウザの通知バーや URL バーの出入りによる縮みは、これより小さい(実測でおよそ 50〜60px)。
 * キーボードは実機でおよそ 250px 以上縮むので、間を取った値にする。
 */
const KEYBOARD_GAP_PX = 120;

export type KeyboardViewport = {
  /** OS のキーボードが出ていると判断したか */
  open: boolean;
  /** シートの下端を持ち上げる量(px)。閉じていれば 0 */
  liftPx: number;
};

const CLOSED: KeyboardViewport = { open: false, liftPx: 0 };

/**
 * OS のソフトウェアキーボードが出ているかを `visualViewport` から読む。0094、issue #242
 *
 * @param active false の間はリスナーを何も付けず、常に閉じている扱いにする。新しい見た目を
 *   入れていない人と PC には 1px も効かせないため、呼び出し側は `newLook && !desktop` を渡す。
 *
 * 開いている間、`document.documentElement` に `data-keyboard-open` を立てる。下のタブの帯
 * (globals.css の `.nl-keyboard-hide`)と、Enter キーでの「次の欄へ」(`keyboard-field-nav.ts`)は
 * この属性を見る。複数の部品がこの hook を同時に使っても、同じ `visualViewport` を読むだけなので、
 * 属性の付け外しは競合しない。
 */
export function useKeyboardViewport(active: boolean): KeyboardViewport {
  const [state, setState] = useState<KeyboardViewport>(CLOSED);

  useEffect(() => {
    if (!active) return;
    const vv = window.visualViewport;
    if (!vv) return;

    function read() {
      // vv は effect のクロージャで非 null と分かっている(この関数は vv が無ければ登録されない)
      const viewport = vv as VisualViewport;
      const gap = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      const open = gap > KEYBOARD_GAP_PX;
      setState(open ? { open: true, liftPx: gap } : CLOSED);
      document.documentElement.toggleAttribute("data-keyboard-open", open);
    }
    read();
    vv.addEventListener("resize", read);
    vv.addEventListener("scroll", read);
    return () => {
      vv.removeEventListener("resize", read);
      vv.removeEventListener("scroll", read);
      document.documentElement.removeAttribute("data-keyboard-open");
      setState(CLOSED);
    };
  }, [active]);

  return state;
}
