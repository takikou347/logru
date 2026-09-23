/** 予定と思い出を探す API の hook。0046 */
import type { CalendarItem } from "@shared/api-types";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

/**
 * 題名と場所を探す。空、あるいは空白だけの文字列では呼ばない。
 * @param query 探す文字列。呼び出し側でデバウンスする
 */
export function useSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ["search", q],
    queryFn: () => api<{ items: CalendarItem[] }>(`/search?q=${encodeURIComponent(q)}`).then((r) => r.items),
    enabled: q.length > 0,
  });
}
