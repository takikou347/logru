import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { CalendarItem } from "@shared/api-types";
import { clientExtension } from "@extensions/client/registry";

const UNDO_MS = 5000;

/** 項目を見分ける名前。拡張が違えば ID が重なりうるので、拡張の名前を前に付ける */
export const itemKey = (item: Pick<CalendarItem, "extension" | "id">) => `${item.extension}:${item.id}`;

/**
 * 消す操作に確認を出さず、5 秒だけ「元に戻す」を出す。0012
 *
 * その間は画面から隠すだけで、5 秒たってから、項目を出した拡張の deleteItem で消す。
 * 画面を閉じたら、待たずにすぐ消す。
 *
 * @returns hidden は隠している項目の itemKey。remove は消す関数
 */
export function useUndoableDelete() {
  const qc = useQueryClient();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const timers = useRef(new Map<string, { timer: number; item: CalendarItem }>());

  const unhide = useCallback((key: string) => {
    setHidden((s) => {
      const next = new Set(s);
      next.delete(key);
      return next;
    });
  }, []);

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
      unhide(key);
    },
    [qc, unhide],
  );

  const remove = useCallback(
    (item: CalendarItem) => {
      const key = itemKey(item);
      setHidden((s) => new Set(s).add(key));
      const timer = window.setTimeout(() => void commit(item), UNDO_MS);
      timers.current.set(key, { timer, item });
      toast("予定を消しました", {
        duration: UNDO_MS,
        action: {
          label: "元に戻す",
          onClick: () => {
            window.clearTimeout(timers.current.get(key)?.timer);
            timers.current.delete(key);
            unhide(key);
          },
        },
      });
    },
    [commit, unhide],
  );

  useEffect(() => {
    const flush = () => {
      for (const { timer, item } of timers.current.values()) {
        window.clearTimeout(timer);
        void commit(item, true);
      }
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [commit]);

  return { hidden, remove };
}
