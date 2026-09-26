/**
 * 一覧の行が、足す・消す・直すで動く 3 つをまとめる。
 *
 * カレンダー(旧 `useCalendarDelete`)、家計簿の記録(旧 `useKakeiboRecordDelete`)、共有リスト
 * (`useListItemDelete`)がそれぞれ書いていた「5 秒の元に戻す(lib/use-undoable-delete)に、縮んで消える動き
 * (leaving)と、動きが終わってから一覧から外す(hidden)の 2 段階を足す」形を 1 つにした。0044、0048、0085、#226
 *
 * 入る動き(item-enter)は `modules/calendar/recent-items.ts` の `markJustAdded`・`takeJustAdded` を、
 * この hook を使う側が引き続き直に呼ぶ。「足した」と「直した」を区別する印がページごとに違うため。
 */
import { useCallback, useRef, useState } from "react";
import { markJustAdded } from "@/modules/calendar/recent-items";
import { useUndoableDelete } from "./use-undoable-delete";

/** 縮んで消える動きの長さ。globals.css の [data-leaving] と同じ --dur-base(220ms)。0044、0048 */
const EXIT_MS = 220;

/** 直した行を光らせる動きの長さ。globals.css の [data-edited] と同じ --dur-slow(320ms)。0085 */
const FLASH_MS = 320;

function without(s: Set<string>, key: string): Set<string> {
  if (!s.has(key)) return s;
  const next = new Set(s);
  next.delete(key);
  return next;
}

function withKey(s: Set<string>, key: string): Set<string> {
  if (s.has(key)) return s;
  const next = new Set(s);
  next.add(key);
  return next;
}

/**
 * 消す・元に戻す・直した印を持つ一覧の行。
 *
 * 消すときは、消した瞬間に一覧から外すのではなく、縮んで消える動き(leaving)の間だけ一覧に残し、
 * 動きが終わってから外す(hidden)。「元に戻す」を押すと、動きの途中でも終わった後でも戻り、
 * 戻った項目は足したときと同じ膨らむ動きで入る(markJustAdded)。
 *
 * 直したときは `flash(key)` を呼ぶ。呼んだ行は `flashing` に一瞬だけ入り、光る動きの長さが終われば自分で外れる。
 *
 * @param message 消したときに出すトーストの文。「予定を消しました」のように
 * @returns hidden は一覧から外す項目の key。leaving は縮んで消える動きの途中の項目の key。
 *   remove は消す関数。flashing は直した動きの途中の項目の key。flash はその動きを始める関数
 */
export function useRowMotion(message: string) {
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [flashing, setFlashing] = useState<Set<string>>(new Set());
  const exitTimers = useRef(new Map<string, number>());
  const flashTimers = useRef(new Map<string, number>());

  const clearExit = useCallback((key: string) => {
    const t = exitTimers.current.get(key);
    if (t != null) {
      window.clearTimeout(t);
      exitTimers.current.delete(key);
    }
  }, []);

  const onRestore = useCallback(
    (key: string) => {
      clearExit(key);
      markJustAdded(key);
      setLeaving((s) => without(s, key));
      setHidden((s) => without(s, key));
    },
    [clearExit],
  );

  const { remove: removePending } = useUndoableDelete(message, onRestore);

  const remove = useCallback(
    (key: string, commitFn: (opts: { keepalive: boolean }) => Promise<unknown>, opts?: { message?: string }) => {
      setLeaving((s) => withKey(s, key));
      exitTimers.current.set(
        key,
        window.setTimeout(() => {
          exitTimers.current.delete(key);
          setHidden((s) => withKey(s, key));
        }, EXIT_MS),
      );
      removePending(
        key,
        async (runOpts) => {
          try {
            return await commitFn(runOpts);
          } finally {
            if (!runOpts.keepalive) {
              setHidden((s) => without(s, key));
              setLeaving((s) => without(s, key));
            }
          }
        },
        opts,
      );
    },
    [removePending],
  );

  /** 直した行を、保存した直後だけ短く光らせる。0085、#226 */
  const flash = useCallback((key: string) => {
    const t = flashTimers.current.get(key);
    if (t != null) window.clearTimeout(t);
    setFlashing((s) => withKey(s, key));
    flashTimers.current.set(
      key,
      window.setTimeout(() => {
        flashTimers.current.delete(key);
        setFlashing((s) => without(s, key));
      }, FLASH_MS),
    );
  }, []);

  return { leaving, hidden, remove, flashing, flash };
}

/**
 * 元に戻すが要らない、消える動きだけの要素。思い出そのもの、招待の取り消し、外部カレンダーの登録。0085、#226
 *
 * `remove` を呼ぶと、縮んで消える動き(leaving)の間だけ画面に残し、動きが終わってから渡した関数を呼ぶ。
 * 一覧から外す・API を呼ぶといった実際の処理は、動きが終わった後にする側に任せる。
 */
export function useExitOnly() {
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const timers = useRef(new Map<string, number>());

  const remove = useCallback((key: string, after: () => void) => {
    setLeaving((s) => withKey(s, key));
    const t = window.setTimeout(() => {
      timers.current.delete(key);
      setLeaving((s) => without(s, key));
      after();
    }, EXIT_MS);
    timers.current.set(key, t);
  }, []);

  return { leaving, remove };
}
