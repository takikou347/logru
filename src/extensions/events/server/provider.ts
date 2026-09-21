import { and, gte, inArray, isNull, lt, or } from "drizzle-orm";
import type { CalendarItem } from "../../../shared/api-types";
import type { DB } from "../../../server/core/db/client";
import { type EventRow, events } from "./schema";

/**
 * 表の 1 行を、カレンダーの項目の形にする。
 * @param row 予定の表の 1 行
 */
export function toCalendarItem(row: EventRow): CalendarItem {
  return {
    extension: "events",
    id: row.id,
    groupId: row.groupId,
    createdBy: row.createdBy,
    startsAt: row.startsAt.getTime(),
    endsAt: row.endsAt?.getTime() ?? null,
    allDay: row.allDay,
    title: row.title,
    memo: row.memo,
  };
}

/**
 * 期間にかかる予定を返す。終わりが期間に入るか、終わりが無く始まりが期間に入るもの。
 * @param db D1 を包んだ Drizzle
 * @param groupIds 呼んでよいグループ
 * @param from 期間の始まり
 * @param to 期間の終わり。含まない
 */
export async function listEvents(db: DB, groupIds: string[], from: number, to: number): Promise<CalendarItem[]> {
  const rows = await db
    .select()
    .from(events)
    .where(
      and(
        inArray(events.groupId, groupIds),
        lt(events.startsAt, new Date(to)),
        or(gte(events.endsAt, new Date(from)), and(isNull(events.endsAt), gte(events.startsAt, new Date(from)))),
      ),
    );
  return rows.map(toCalendarItem);
}
