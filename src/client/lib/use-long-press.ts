/**
 * アイコンだけの操作に、長押しで名前を出す仕組み。0.45 秒押すと出て、離すと消える。issue #239
 *
 * 長押しから離したときは、操作(クリック・押した先への遷移)をしない。`onClick` に渡す前に
 * `consumeLongPress()` を呼び、true なら `event.preventDefault()` して抜ける。
 */
import { useCallback, useRef, useState } from "react";

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
      onPointerUp,
      onPointerLeave: onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
