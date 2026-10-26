/**
 * アイコンだけの操作に、長押しで名前を出す仕組み。0.45 秒押すと出て、離すと消える。issue #239
 *
 * 長押しから離したときは、操作(クリック・押した先への遷移)をしない。`onClick` に渡す前に
 * `consumeLongPress()` を呼び、true なら `event.preventDefault()` して抜ける。
 */
import { useCallback, useEffect, useRef, useState } from "react";

const LONG_PRESS_MS = 450;

export function useLongPressLabel() {
  const [pressed, setPressed] = useState(false);
  const timer = useRef<number | null>(null);
  const fired = useRef(false);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const onPointerDown = useCallback(() => {
    fired.current = false;
    clearTimer();
    timer.current = window.setTimeout(() => {
      fired.current = true;
      setPressed(true);
    }, LONG_PRESS_MS);
  }, [clearTimer]);

  const onPointerUp = useCallback(() => {
    clearTimer();
    setPressed(false);
  }, [clearTimer]);

  /** 長押しで名前を出していたら true を返し、次に呼ぶまで false に戻す */
  const consumeLongPress = useCallback(() => {
    const was = fired.current;
    fired.current = false;
    return was;
  }, []);

  return {
    pressed,
    consumeLongPress,
    handlers: {
      onPointerDown,
      onKeyDown: () => {
        fired.current = false;
      },
      onPointerUp,
      onPointerLeave: onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}

const HOLD_ACTION_MS = 500;
/** 押したまま動いてよい距離(px)。これを越えたら、スクロールや選び直しとみなして取り消す */
const HOLD_SLOP_PX = 10;

/**
 * 長押しで操作を 1 つ走らせる仕組み。0.5 秒押し続けると `onFire` を呼ぶ。0102、issue #312
 *
 * 押している間は `holding` が true で、見た目を沈ませるのに使う。離す・外れる・指が動くと取り消す。
 * 走らせたあとの離した瞬間のクリックは、`consumeLongPress()` が true のとき `preventDefault()` して捨てる。
 * 長押しが使えない読み上げ・キーボードの人は、押す(クリック)の今までの動きを使う。
 */
export function useLongPressAction(onFire: () => void) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const latest = useRef(onFire);
  latest.current = onFire;

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);
  useEffect(() => clearTimer, [clearTimer]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // マウスの右ボタンなどは対象にしない
      fired.current = false;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      start.current = { x: e.clientX, y: e.clientY };
      clearTimer();
      setHolding(true);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        fired.current = true;
        latest.current();
      }, HOLD_ACTION_MS);
    },
    [clearTimer],
  );

  const end = useCallback(() => {
    clearTimer();
    start.current = null;
    setHolding(false);
  }, [clearTimer]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const s = start.current;
      if (!s || timer.current === null) return;
      if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > HOLD_SLOP_PX) end();
    },
    [end],
  );

  /** 長押しで走らせていたら true を返し、次に呼ぶまで false に戻す */
  const consumeLongPress = useCallback(() => {
    const was = fired.current;
    fired.current = false;
    return was;
  }, []);

  return {
    holding,
    consumeLongPress,
    handlers: {
      onPointerDown,
      onPointerMove,
      onKeyDown: () => {
        fired.current = false;
      },
      onPointerUp: end,
      onPointerLeave: end,
      onPointerCancel: end,
      // 長押しの端末の既定(メニュー)を出さない
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    },
  };
}
