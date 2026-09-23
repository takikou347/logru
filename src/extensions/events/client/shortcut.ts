import type { ExtensionShortcut } from "@extensions/client/types";
import { useQuery } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { api } from "@/api/client";
import { DAY_MS, formatDay, startOfDay } from "@/lib/dates";

/** `GET /api/events/upcoming-anniversary` の応答。0043 */
type UpcomingAnniversary = { id: string; title: string; occurrenceAt: number } | null;

const anniversaryKey = ["events", "upcoming-anniversary"] as const;

/** 7 日以内に近づいた、毎年の繰り返しの予定。無ければ null。F-37 */
function useUpcomingAnniversary(enabled: boolean) {
  return useQuery({
    queryKey: anniversaryKey,
    queryFn: () => api<{ item: UpcomingAnniversary }>("/events/upcoming-anniversary").then((r) => r.item),
    enabled,
    staleTime: 60 * 60 * 1000,
  });
}

/**
 * その日までの日数の文。今日なら「今日」、明日なら「明日」。
 * 時刻を含んだまま引くと、日をまたぐ手前でも 1 日多く数えるので、どちらも 0 時に揃えてから引く
 */
export function daysUntilLabel(occurrenceAt: number): string {
  const todayStart = startOfDay(new Date()).getTime();
  const occurrenceDayStart = startOfDay(new Date(occurrenceAt)).getTime();
  const days = Math.round((occurrenceDayStart - todayStart) / DAY_MS);
  if (days <= 0) return "今日";
  if (days === 1) return "明日";
  return `あと${days}日`;
}

/**
 * 近道の帯に出す、誕生日と記念日。毎年の繰り返しを選んだ予定の、次の回が 7 日以内に近づいたとき返す。F-37
 * 押すと、その予定のシートが開く。
 * @param enabled 予定の拡張はいつも有効なので、カレンダーが渡す真偽をそのまま使う
 */
export function useAnniversaryShortcut(enabled: boolean): ExtensionShortcut | null {
  const { data } = useUpcomingAnniversary(enabled);
  if (!enabled || !data) return null;
  return {
    label: data.title,
    sub: `${formatDay(new Date(data.occurrenceAt))}・${daysUntilLabel(data.occurrenceAt)}`,
    path: `/?openExt=events&openId=${data.id}`,
    action: "見る",
    icon: Gift,
  };
}
