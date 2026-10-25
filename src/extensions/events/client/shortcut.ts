import type { ExtensionShortcut } from "@extensions/client/types";
import { useQuery } from "@tanstack/react-query";
import { Gift, PartyPopper } from "lucide-react";
import { api } from "@/api/client";
import { DAY_MS, dateKey, formatDay, startOfDay } from "@/lib/dates";
import { useToday } from "@/lib/use-today";

/** `GET /api/events/upcoming-anniversary` の応答。0043、0097 */
type UpcomingAnniversary = {
  id: string;
  title: string;
  occurrenceAt: number;
  kind: "birthday" | "anniversary";
  /** 始まりの年からの差。0 なら最初の年で、まだ「◯年目」と呼べない */
  yearsSince: number;
} | null;

const anniversaryKey = ["events", "upcoming-anniversary"] as const;

/** 7 日以内に近づいた、毎年の繰り返しの予定。無ければ null。F-37 */
function useUpcomingAnniversary(enabled: boolean) {
  // 鍵に今日の日付を入れる。日が変われば取り直し、昨日の回を今日として出し続けない。#300
  const day = dateKey(useToday());
  return useQuery({
    queryKey: [...anniversaryKey, day],
    queryFn: () => api<{ item: UpcomingAnniversary }>("/events/upcoming-anniversary").then((r) => r.item),
    enabled,
    staleTime: 60 * 60 * 1000,
  });
}

/**
 * その日までの日数の文。今日なら「今日」、明日なら「明日」。過ぎた日は今日にせず、空文字を返す
 * 時刻を含んだまま引くと、日をまたぐ手前でも 1 日多く数えるので、どちらも 0 時に揃えてから引く
 */
export function daysUntilLabel(occurrenceAt: number): string {
  const todayStart = startOfDay(new Date()).getTime();
  const occurrenceDayStart = startOfDay(new Date(occurrenceAt)).getTime();
  const days = Math.round((occurrenceDayStart - todayStart) / DAY_MS);
  if (days < 0) return "";
  if (days === 0) return "今日";
  if (days === 1) return "明日";
  return `あと${days}日`;
}

/**
 * 今日が誕生日・記念日の当日か。今日のページの紙吹雪の合図。F-49、0098
 * 近道の帯と同じ問い合わせを使う(キャッシュを共有する)。次の回が今日なら true
 */
export function useAnniversaryToday(enabled: boolean): boolean {
  const { data } = useUpcomingAnniversary(enabled);
  return enabled && !!data && daysUntilLabel(data.occurrenceAt) === "今日";
}

/**
 * 近道の帯に出す、誕生日と記念日。毎年の繰り返しを選んだ予定の、次の回が 7 日以内に近づいたとき返す。F-37
 * 押すと、その予定のシートが開く。
 *
 * 誕生日は今までどおり(題名と、日付・あと何日)。記念日は形はそのままで、アイコンと文言だけ変える。
 * 何年目かが分かれば添える(最初の年はまだ 1 年目と呼べないので添えない)。F-48、0097
 * @param enabled 予定の拡張はいつも有効なので、カレンダーが渡す真偽をそのまま使う
 */
export function useAnniversaryShortcut(enabled: boolean): ExtensionShortcut | null {
  const { data } = useUpcomingAnniversary(enabled);
  if (!enabled || !data) return null;
  // 過ぎた回は出さない。日をまたいだ直後、取り直しが届くまでの間もここで隠す
  if (daysUntilLabel(data.occurrenceAt) === "") return null;
  if (data.kind !== "anniversary") {
    return {
      label: data.title,
      sub: `${formatDay(new Date(data.occurrenceAt))}・${daysUntilLabel(data.occurrenceAt)}`,
      path: `/?openExt=events&openId=${data.id}`,
      action: "見る",
      icon: Gift,
    };
  }
  const until = daysUntilLabel(data.occurrenceAt);
  const isToday = until === "今日";
  const yearLabel = data.yearsSince > 0 ? `${data.yearsSince}年目` : null;
  return {
    label: isToday ? `今日は${data.title}の日` : `${data.title}まで`,
    sub: isToday
      ? (yearLabel ?? formatDay(new Date(data.occurrenceAt)))
      : [until, yearLabel].filter(Boolean).join("・"),
    path: `/?openExt=events&openId=${data.id}`,
    action: "見る",
    icon: PartyPopper,
  };
}
