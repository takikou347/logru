/**
 * 消す操作に確認を出さず、5 秒だけ「元に戻す」を出す共通の部品。0012、issue #12
 *
 * 項目を画面から隠す・戻すところまではこの hook が持ち、実際に消す API 呼び出しは呼び出し側が渡す。
 * 「元に戻す」を押すと、5 秒たっていなければ消す前の状態に戻る。画面を閉じたら、待たずにすぐ消す。
 *
 * カレンダーは、消した直後に縮んで消える動き(leaving)を挟む分だけ、この hook を包んで使う。
 * `modules/calendar/CalendarPage.tsx` の `useCalendarDelete` を参照。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const UNDO_MS = 5000;

function without(s: Set<string>, key: string): Set<string> {
  if (!s.has(key)) return s;
  const next = new Set(s);
  next.delete(key);
  return next;
}

/**
 * @param message 消したときに出すトーストの文。「予定を消しました」のように
 * @param onRestore 「元に戻す」を押した瞬間に呼ぶ。足したときと同じ動きで戻す印を付けるときなどに使う
 * @returns pending は消す途中(元に戻せる間)の項目の key。一覧を出すとき、この key を除いて表示する
 */
export function useUndoableDelete(message: string, onRestore?: (key: string) => void) {
  const [pending, setPending] = useState<Set<string>>(new Set());
  const timers = useRef(
    new Map<string, { timer: number; commit: (opts: { keepalive: boolean }) => Promise<unknown> }>(),
  );

  const commit = useCallback(
    async (key: string, run: (opts: { keepalive: boolean }) => Promise<unknown>, keepalive = false) => {
      timers.current.delete(key);
      try {
        await run({ keepalive });
      } catch (e) {
        if (!keepalive) toast.error((e as Error).message);
      }
      if (!keepalive) setPending((s) => without(s, key));
    },
    [],
  );

  const restore = useCallback(
    (key: string) => {
      onRestore?.(key);
      setPending((s) => without(s, key));
    },
    [onRestore],
  );

  /**
   * 消す。すぐには commitFn を呼ばず、5 秒たってから呼ぶ。「元に戻す」を押すと呼ばずに戻す。
   * @param key 項目を見分ける名前。同じ画面で重ならない ID にする
   * @param commitFn 5 秒後に呼ぶ、実際に消す関数。画面を閉じて送り切るときは keepalive が true で渡る
   */
  const remove = useCallback(
    (key: string, commitFn: (opts: { keepalive: boolean }) => Promise<unknown>) => {
      setPending((s) => (s.has(key) ? s : new Set(s).add(key)));
      const timer = window.setTimeout(() => void commit(key, commitFn), UNDO_MS);
      timers.current.set(key, { timer, commit: commitFn });
      toast(message, {
        duration: UNDO_MS,
        action: {
          label: "元に戻す",
          onClick: () => {
            const t = timers.current.get(key);
            if (t) {
              window.clearTimeout(t.timer);
              timers.current.delete(key);
            }
            restore(key);
          },
        },
      });
    },
    [commit, message, restore],
  );

  // 画面を閉じるときは、待たずに消す処理を送り切る
  useEffect(() => {
    const flush = () => {
      for (const [key, t] of timers.current) {
        window.clearTimeout(t.timer);
        void commit(key, t.commit, true);
      }
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [commit]);

  return { pending, remove };
}
