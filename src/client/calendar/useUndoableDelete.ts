import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CalendarItem } from "../../shared/api-types";
import { api } from "../lib/api";
import { useToast } from "../ui/Toast";

const UNDO_MS = 5000;

/**
 * 消す操作に確認を出さず、5 秒だけ「元に戻す」を出す。0012
 * その間は画面から隠すだけで、5 秒たってから消す。画面を閉じたらすぐ消す。
 */
export function useUndoableDelete() {
  const qc = useQueryClient();
  const toast = useToast();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const timers = useRef(new Map<string, number>());

  const commit = useCallback(
    async (id: string, keepalive = false) => {
      timers.current.delete(id);
      try {
        await api(`/events/${id}`, { method: "DELETE", keepalive });
      } catch (e) {
        if (!keepalive) toast({ message: (e as Error).message, tone: "error" });
      }
      if (keepalive) return;
      await qc.invalidateQueries({ queryKey: ["calendar"] });
      setHidden((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    },
    [qc, toast],
  );

  const remove = useCallback(
    (item: CalendarItem) => {
      setHidden((s) => new Set(s).add(item.id));
      const timer = window.setTimeout(() => void commit(item.id), UNDO_MS);
      timers.current.set(item.id, timer);
      toast({
        message: "予定を消しました",
        ms: UNDO_MS,
        action: {
          label: "元に戻す",
          onClick: () => {
            window.clearTimeout(timers.current.get(item.id));
            timers.current.delete(item.id);
            setHidden((s) => {
              const next = new Set(s);
              next.delete(item.id);
              return next;
            });
          },
        },
      });
    },
    [commit, toast],
  );

  useEffect(() => {
    const flush = () => {
      for (const [id, timer] of timers.current) {
        window.clearTimeout(timer);
        void commit(id, true);
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
