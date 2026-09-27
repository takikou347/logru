/** 1 年をらせんで見る画面だけが使う API の hook。0051 */

import type { CalendarItem } from "@shared/api-types";
import { useQueries } from "@tanstack/react-query";
import { api } from "@/api/client";
import { keys } from "@/api/keys";
import { yearChunks } from "./year-range";

/**
 * 1 年分のカレンダーの項目を読む。
 * `GET /api/calendar` の 1 回あたりの上限に収まるよう、期間を分けて並列に読み、まとめて返す。
 * キャッシュのキーは月・週・日の表と同じ形なので、境目が重なれば読み直さずに済む。
 * @param year 西暦
 */
export function useYearCalendar(year: number) {
  const results = useQueries({
    queries: yearChunks(year).map(({ from, to }) => ({
      queryKey: keys.calendar(from, to),
      queryFn: () => api<{ items: CalendarItem[] }>(`/calendar?from=${from}&to=${to}`).then((r) => r.items),
      staleTime: 5 * 60 * 1000,
    })),
  });
  return {
    items: results.flatMap((r) => r.data ?? []),
    isLoading: results.some((r) => r.isLoading),
    isError: results.some((r) => r.isError),
  };
}
