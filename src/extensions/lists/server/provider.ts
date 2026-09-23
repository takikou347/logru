import type { DB } from "@server/core/db/client";
import type { CalendarItem } from "@shared/api-types";
import { and, between, inArray, isNotNull, like } from "drizzle-orm";
import { DAY_MS, dateKeyOfJst, startOfDateJst } from "../shared/dates";
import { type ListRow, lists } from "./schema";

/** listListItems と searchLists が選ぶ列 */
type ListRowForItem = Pick<ListRow, "id" | "groupId" | "createdBy" | "title" | "date" | "createdAt">;

/**
 * リストをカレンダーの項目の形にする。0008、0054
 * 日付が無いリストは、探す(0046)の結果でだけ使う。作った時刻を仮の日として並べる。
 * @param row リストの表の 1 行
 */
function toCalendarItem(row: ListRowForItem): CalendarItem {
  const hasDate = row.date !== null;
  const start = hasDate ? startOfDateJst(row.date as string) : row.createdAt.getTime();
  return {
    extension: "lists",
    id: row.id,
    groupId: row.groupId,
    createdBy: row.createdBy,
    startsAt: start,
    endsAt: hasDate ? start + DAY_MS : null,
    allDay: hasDate,
    title: row.title,
    tag: "リスト",
  };
}

/**
 * カレンダーへ渡す項目。日付の付いたリストだけを、その日の終日の項目として渡す。F-208
 * @param db D1 を包んだ Drizzle
 * @param groupIds 呼んでよいグループ。リストの拡張が有効なものだけ
 * @param from 期間の始まり。ミリ秒の協定世界時
 * @param to 期間の終わり。含まない
 */
export async function listListItems(db: DB, groupIds: string[], from: number, to: number): Promise<CalendarItem[]> {
  if (groupIds.length === 0) return [];
  // 日付は文字列で持つので、期間を日本時間の日付の範囲に変えて絞る。to は含まないので 1 ミリ秒引く
  const fromKey = dateKeyOfJst(from);
  const toKey = dateKeyOfJst(to - 1);
  const rows = await db
    .select({
      id: lists.id,
      groupId: lists.groupId,
      createdBy: lists.createdBy,
      title: lists.title,
      date: lists.date,
      createdAt: lists.createdAt,
    })
    .from(lists)
    .where(and(inArray(lists.groupId, groupIds), isNotNull(lists.date), between(lists.date, fromKey, toKey)));
  return rows.map(toCalendarItem);
}

/**
 * 名前を探す。0046
 * 日付の無いリストも対象にする。開くのはリストの画面自身で、カレンダーの日には依らない。
 * @param db D1 を包んだ Drizzle
 * @param groupIds 呼んでよいグループ
 * @param query 探す文字列
 */
export async function searchLists(db: DB, groupIds: string[], query: string): Promise<CalendarItem[]> {
  if (groupIds.length === 0) return [];
  const rows = await db
    .select({
      id: lists.id,
      groupId: lists.groupId,
      createdBy: lists.createdBy,
      title: lists.title,
      date: lists.date,
      createdAt: lists.createdAt,
    })
    .from(lists)
    .where(and(inArray(lists.groupId, groupIds), like(lists.title, `%${query}%`)));
  return rows.map(toCalendarItem);
}
