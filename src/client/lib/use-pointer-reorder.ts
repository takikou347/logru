import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

/** 端末の端からこの距離に入ったら自動でスクロールする */
const AUTO_SCROLL_EDGE = 72;
/** 自動スクロールの速さ。1 フレームあたりの px */
const AUTO_SCROLL_SPEED = 14;

export type PointerReorderDrag = {
  /** ドラッグしている元の位置 */
  index: number;
  /** 指を離したら移る先。指の位置にいちばん近い枠 */
  overIndex: number;
  /** 持ち手を押した場所から、いまの指の位置までのずれ */
  dx: number;
  dy: number;
};

/** ドラッグが始まったときだけ変わる。位置の細かい更新ではこの値は変えない */
type DragStart = { index: number; pointerId: number };

/**
 * Pointer Events で、指でもマウスでも動くドラッグの並べ替え。専用のライブラリは使わない。0029、#121
 * ホームのウィジェット(WidgetGrid)と、機能のタイルの並び(ExtensionTileGrid)が同じ hook を使う。0058
 *
 * 持ち手の pointerdown から始め、pointer capture で指を追う。並べ替え先は、各枠の中心と指の距離が
 * いちばん近いものにする。画面の端に来たら window を自動でスクロールする。
 * disabled が true の間はドラッグを始めない。並べ替えのボタンは呼び出し側で別に用意する。
 * dx・dy は常に返す。枠を指に付いて動かすかどうか(動きを減らす設定への応え方)は呼び出し側が決める。#121
 */
export function usePointerReorder(count: number, disabled: boolean, onReorder: (from: number, to: number) => void) {
  // start はドラッグの開始と終了だけで変わる。位置の更新は live に持ち、window のイベント購読を張り直さない
  const [start, setStart] = useState<DragStart | null>(null);
  const [live, setLive] = useState({ overIndex: 0, dx: 0, dy: 0 });
  const slotRefs = useRef<(HTMLElement | null)[]>([]);
  const refCallbacks = useRef<Map<number, (el: HTMLElement | null) => void>>(new Map());
  const startPos = useRef({ x: 0, y: 0 });
  const edgeDir = useRef<-1 | 0 | 1>(0);

  /** 枠 1 つずつの位置を測るための ref。番号ごとに同じ関数を返し、無駄な付け外しをしない */
  const registerSlot = useCallback((index: number) => {
    let cb = refCallbacks.current.get(index);
    if (!cb) {
      cb = (el: HTMLElement | null) => {
        slotRefs.current[index] = el;
      };
      refCallbacks.current.set(index, cb);
    }
    return cb;
  }, []);

  const nearestIndex = useCallback(
    (x: number, y: number) => {
      let best = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < count; i++) {
        const el = slotRefs.current[i];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const dx = rect.left + rect.width / 2 - x;
        const dy = rect.top + rect.height / 2 - y;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      }
      return best;
    },
    [count],
  );

  const onHandlePointerDown = useCallback(
    (index: number) => (e: ReactPointerEvent<HTMLElement>) => {
      if (disabled) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      startPos.current = { x: e.clientX, y: e.clientY };
      setLive({ overIndex: index, dx: 0, dy: 0 });
      setStart({ index, pointerId: e.pointerId });
    },
    [disabled],
  );

  // ドラッグしている間だけ window に付ける。start はドラッグ中変わらないので、張り直しは始めと終わりだけで済む
  useEffect(() => {
    if (start === null) return;

    let raf = 0;
    const scrollStep = () => {
      if (edgeDir.current !== 0) window.scrollBy(0, edgeDir.current * AUTO_SCROLL_SPEED);
      raf = requestAnimationFrame(scrollStep);
    };
    raf = requestAnimationFrame(scrollStep);

    const onMove = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== start.pointerId) return;
      const overIndex = nearestIndex(e.clientX, e.clientY);
      edgeDir.current = e.clientY < AUTO_SCROLL_EDGE ? -1 : e.clientY > window.innerHeight - AUTO_SCROLL_EDGE ? 1 : 0;
      setLive({ overIndex, dx: e.clientX - startPos.current.x, dy: e.clientY - startPos.current.y });
    };

    const end = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== start.pointerId) return;
      edgeDir.current = 0;
      setLive((l) => {
        if (l.overIndex !== start.index) onReorder(start.index, l.overIndex);
        return l;
      });
      setStart(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [start, nearestIndex, onReorder]);

  const drag: PointerReorderDrag | null = start && {
    index: start.index,
    overIndex: live.overIndex,
    dx: live.dx,
    dy: live.dy,
  };

  return { drag, registerSlot, onHandlePointerDown };
}
