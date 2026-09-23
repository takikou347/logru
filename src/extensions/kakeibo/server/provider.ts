import type { DB } from "@server/core/db/client";
import type { CalendarItem } from "@shared/api-types";
import { and, between, inArray } from "drizzle-orm";
import { DAY_MS, dateKeyOfJst, startOfDateJst } from "../shared/dates";
import { formatYen } from "../shared/format";
import { kakeiboExpenses } from "./schema";

/**
 * カレンダーへ渡す項目。0008、0047
 *
 * 記録 1 件ずつではなく、グループと日ごとに合計金額を 1 項目にまとめる。終日の項目で、
 * 予定の一覧には混ぜない(`secondary`)。押すと、その日を含む月の家計簿の画面へ移る。
 *
 * @param db D1 を包んだ Drizzle
 * @param groupIds 呼んでよいグループ。家計簿の拡張が有効なものだけ
 * @param from 期間の始まり。ミリ秒の協定世界時
 * @param to 期間の終わり。含まない
 */
export async function listKakeiboItems(db: DB, groupIds: string[], from: number, to: number): Promise<CalendarItem[]> {
  if (groupIds.length === 0) return [];
  // 日付は文字列で持つので、期間を日本時間の日付の範囲に変えて絞る。to は含まないので 1 ミリ秒引く
  const fromKey = dateKeyOfJst(from);
  const toKey = dateKeyOfJst(to - 1);
  const rows = await db
    .select({ groupId: kakeiboExpenses.groupId, date: kakeiboExpenses.date, amount: kakeiboExpenses.amount })
    .from(kakeiboExpenses)
    .where(and(inArray(kakeiboExpenses.groupId, groupIds), between(kakeiboExpenses.date, fromKey, toKey)));

  const totals = new Map<string, { groupId: string; date: string; amount: number }>();
  for (const r of rows) {
    const key = `${r.groupId}\u0000${r.date}`;
    const t = totals.get(key) ?? { groupId: r.groupId, date: r.date, amount: 0 };
    t.amount += r.amount;
    totals.set(key, t);
  }

  return [...totals.values()].map((t) => {
    const start = startOfDateJst(t.date);
    return {
      extension: "kakeibo",
      id: `${t.groupId}:${t.date}`,
      groupId: t.groupId,
      createdBy: null,
      startsAt: start,
      endsAt: start + DAY_MS,
      allDay: true,
      title: formatYen(t.amount),
      tag: "家計簿",
      secondary: true,
    };
  });
}
