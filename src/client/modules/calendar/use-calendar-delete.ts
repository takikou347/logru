/**
 * カレンダーの項目を消す。足す・消す・元に戻すの動きそのものは lib/use-row-motion が持つ。ここで足すのは、
 * 項目を出した拡張の deleteItem を呼び、消えたらカレンダーを読み直すこと。0012、0044、0048、0085、#98
 *
 * CalendarPage(月・週・日)と、今日のページ(0092)の両方が使う。
 */
import { clientExtension } from "@extensions/client/registry";
import type { ItemEditScope } from "@extensions/client/types";
import type { CalendarItem } from "@shared/api-types";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useRowMotion } from "@/lib/use-row-motion";
import { itemKey } from "./model";

/**
 * @returns hidden は一覧から外す項目の itemKey。leaving は縮んで消える動きの途中の itemKey。remove は消す関数
 */
export function useCalendarDelete() {
  const qc = useQueryClient();
  const { hidden, leaving, remove: removeRow } = useRowMotion("予定を消しました");

  const remove = useCallback(
    (item: CalendarItem, scope?: ItemEditScope) => {
      const key = itemKey(item);
      removeRow(key, async (opts) => {
        try {
          await clientExtension(item.extension)?.deleteItem?.(item.id, {
            ...opts,
            occurrenceAt: item.occurrenceAt,
            scope,
          });
        } finally {
          if (!opts.keepalive) await qc.invalidateQueries({ queryKey: ["calendar"] });
        }
      });
    },
    [removeRow, qc],
  );

  return { hidden, leaving, remove };
}
