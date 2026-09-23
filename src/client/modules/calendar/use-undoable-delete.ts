import { clientExtension } from "@extensions/client/registry";
import type { CalendarItem } from "@shared/api-types";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { markJustAdded } from "./recent-items";

const UNDO_MS = 5000;
/** 縮んで消える動きの長さ。globals.css の [data-leaving] と同じ --dur-base(220ms)。0044、0048 */
const EXIT_MS = 220;

/** 項目を見分ける名前。拡張が違えば ID が重なりうるので、拡張の名前を前に付ける */
export const itemKey = (item: Pick<CalendarItem, "extension" | "id">) => `${item.extension}:${item.id}`;

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
 * 消す操作に確認を出さず、5 秒だけ「元に戻す」を出す。0012
 *
 * 消した瞬間は一覧に残したまま縮んで消える動きだけを見せ(leaving)、動きが終わってから一覧から外す(hidden)。
 * その間は画面から隠すだけで、5 秒たってから、項目を出した拡張の deleteItem で消す。
 * 画面を閉じたら、待たずにすぐ消す。
 *
 * 「元に戻す」を押すと、動きの途中でも終わった後でも戻り、戻った項目は足したときと同じ膨らむ動きで入る。0044、0048、#98
 *
 * @returns hidden は一覧から外す項目の itemKey。leaving は縮んで消える動きの途中の itemKey。remove は消す関数
 */
export function useUndoableDelete() {
  const qc = useQueryClient();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const timers = useRef(new Map<string, { exitTimer: number; commitTimer: number; item: CalendarItem }>());

  const commit = useCallback(
    async (item: CalendarItem, keepalive = false) => {
      const key = itemKey(item);
      timers.current.delete(key);
      try {
        await clientExtension(item.extension)?.deleteItem?.(item.id, { keepalive });
      } catch (e) {
        if (!keepalive) toast.error((e as Error).message);
      }
      if (keepalive) return;
      await qc.invalidateQueries({ queryKey: ["calendar"] });
      setHidden((s) => without(s, key));
      setLeaving((s) => without(s, key));
    },
    [qc],
  );

  const restore = useCallback((key: string) => {
    // 一覧から外れていた(unmount していた)分は、足したときと同じ動きで戻す
    markJustAdded(key);
    setLeaving((s) => without(s, key));
    setHidden((s) => without(s, key));
  }, []);

  const remove = useCallback(
    (item: CalendarItem) => {
      const key = itemKey(item);
      setLeaving((s) => withKey(s, key));
      const exitTimer = window.setTimeout(() => setHidden((s) => withKey(s, key)), EXIT_MS);
      const commitTimer = window.setTimeout(() => void commit(item), UNDO_MS);
      timers.current.set(key, { exitTimer, commitTimer, item });
      toast("予定を消しました", {
        duration: UNDO_MS,
        action: {
          label: "元に戻す",
          onClick: () => {
            const t = timers.current.get(key);
            if (t) {
              window.clearTimeout(t.exitTimer);
              window.clearTimeout(t.commitTimer);
              timers.current.delete(key);
            }
            restore(key);
          },
        },
      });
    },
    [commit, restore],
  );

  useEffect(() => {
    const flush = () => {
      for (const { exitTimer, commitTimer, item } of timers.current.values()) {
        window.clearTimeout(exitTimer);
        window.clearTimeout(commitTimer);
        void commit(item, true);
      }
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [commit]);

  return { hidden, leaving, remove };
}
