/** カレンダーの画面だけが使う API の hook */

import type { CalendarItem, Me } from "@shared/api-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { keys } from "@/api/keys";
import { addDays, monthGrid } from "@/lib/dates";

/**
 * 期間のカレンダーの項目を読む。月を移る間は前の項目を出したままにする。
 * @param from 期間の始まり。ミリ秒の UTC
 * @param to 期間の終わり。含まない
 */
export function useCalendar(from: number, to: number) {
  return useQuery({
    queryKey: keys.calendar(from, to),
    queryFn: () => api<{ items: CalendarItem[] }>(`/calendar?from=${from}&to=${to}`).then((r) => r.items),
    placeholderData: (prev) => prev,
  });
}

/**
 * ある月の表に並ぶ日と、その期間の生の項目を読む。月送りの日めくり(MonthFlipDeck)が、隣の月を先読みするのに使う。#99
 *
 * 表の期間は CalendarPage の月の表と同じ `monthGrid` で計算するので、同じ月なら
 * queryKey が揃い、CalendarPage 側の読み込みとキャッシュを共有する。
 * @param monthAnchor その月に含まれる、どの日でもよい
 */
export function useMonthGrid(monthAnchor: Date) {
  const time = monthAnchor.getTime();
  // biome-ignore lint/correctness/useExhaustiveDependencies: Date は毎回新しい参照になるので、時刻の値で比べる
  const days = useMemo(() => monthGrid(monthAnchor), [time]);
  const from = days[0]!.getTime();
  const to = addDays(days[days.length - 1]!, 1).getTime();
  const calendar = useCalendar(from, to);
  return { days, raw: calendar.data };
}

/**
 * その人が作った予定を、自分のカレンダーに出すかを変える。自分の画面だけの設定。F-20
 *
 * 押した瞬間に画面に効かせ、失敗したら元に戻して知らせる。
 */
export function useMemberVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, hidden }: { userId: string; hidden: boolean }) =>
      api(`/me/visibility/${userId}`, { method: "PUT", body: { hidden } }),
    onMutate: async ({ userId, hidden }) => {
      await qc.cancelQueries({ queryKey: keys.me });
      const prev = qc.getQueryData<Me>(keys.me);
      if (prev) {
        const rest = prev.hiddenMembers.filter((id) => id !== userId);
        qc.setQueryData<Me>(keys.me, { ...prev, hiddenMembers: hidden ? [...rest, userId] : rest });
      }
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.me, ctx.prev);
      toast.error((e as Error).message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.me }),
  });
}
