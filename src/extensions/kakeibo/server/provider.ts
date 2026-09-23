import type { DB } from "@server/core/db/client";
import type { CalendarItem } from "@shared/api-types";
import { and, between, eq, inArray, like } from "drizzle-orm";
import { DAY_MS, dateKeyOfJst, startOfDateJst } from "../shared/dates";
import { formatYen } from "../shared/format";
import { sumAmount } from "../shared/totals";
import { kakeiboExpenses } from "./schema";

/**
 * グループと日ごとの合計を、カレンダーの項目の形にする。0008、0047
 * 終日の項目で、予定の一覧には混ぜない(`secondary`)。押すと、その日を含む月の家計簿の画面へ移る。
 * @param groupId その日の合計のグループ
 * @param date `2026-09-22` の形の日付
 * @param amount その日の合計金額
 */
function toDayItem(groupId: string, date: string, amount: number): CalendarItem {
  const start = startOfDateJst(date);
  return {
    extension: "kakeibo",
    id: `${groupId}:${date}`,
    groupId,
    createdBy: null,
    startsAt: start,
    endsAt: start + DAY_MS,
    allDay: true,
    title: formatYen(amount),
    tag: "家計簿",
    secondary: true,
  };
}

/**
 * カレンダーへ渡す項目。記録 1 件ずつではなく、グループと日ごとに合計金額を 1 項目にまとめる。
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

  const totals = new Map<string, { groupId: string; date: string; amounts: number[] }>();
  for (const r of rows) {
    const key = `${r.groupId}\u0000${r.date}`;
    const t = totals.get(key) ?? { groupId: r.groupId, date: r.date, amounts: [] };
    t.amounts.push(r.amount);
    totals.set(key, t);
  }
  return [...totals.values()].map((t) =>
    toDayItem(t.groupId, t.date, sumAmount(t.amounts.map((amount) => ({ amount })))),
  );
}

/**
 * メモを探す。0046
 *
 * 家計簿は記録ごとの題名を持たず、日ごとの合計だけをカレンダーの項目にしている。0047
 * メモが見つかった日は、その日全体の合計を検索結果として返す。個別の金額は家計簿の画面で見る。
 * @param db D1 を包んだ Drizzle
 * @param groupIds 呼んでよいグループ
 * @param query 探す文字列
 */
export async function searchKakeibo(db: DB, groupIds: string[], query: string): Promise<CalendarItem[]> {
  if (groupIds.length === 0) return [];
  const matched = await db
    .select({ groupId: kakeiboExpenses.groupId, date: kakeiboExpenses.date })
    .from(kakeiboExpenses)
    .where(and(inArray(kakeiboExpenses.groupId, groupIds), like(kakeiboExpenses.memo, `%${query}%`)));
  const days = new Map(matched.map((r) => [`${r.groupId}\u0000${r.date}`, r]));

  return Promise.all(
    [...days.values()].map(async ({ groupId, date }) => {
      const rows = await db
        .select({ amount: kakeiboExpenses.amount })
        .from(kakeiboExpenses)
        .where(and(eq(kakeiboExpenses.groupId, groupId), eq(kakeiboExpenses.date, date)));
      return toDayItem(groupId, date, sumAmount(rows));
    }),
  );
}
