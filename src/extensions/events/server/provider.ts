import type { CalendarContext } from "@extensions/server/types";
import type { DB } from "@server/core/db/client";
import type { Attendee, CalendarItem } from "@shared/api-types";
import { and, gte, inArray, isNull, lt, or } from "drizzle-orm";
import { type EventRow, eventAttendees, events } from "./schema";

/** D1 は 1 つの問い合わせに渡せる値の数に上限がある。予定の ID はこの数ずつ渡す */
const CHUNK = 90;

/**
 * 予定ごとの参加者を読む。作った人を先頭に、返事を付けて返す。#28
 * @param db D1 を包んだ Drizzle
 * @param eventIds 予定の ID
 */
export async function loadAttendees(db: DB, eventIds: string[]): Promise<Map<string, Attendee[]>> {
  const byEvent = new Map<string, Attendee[]>();
  for (let i = 0; i < eventIds.length; i += CHUNK) {
    const rows = await db
      .select({ eventId: eventAttendees.eventId, userId: eventAttendees.userId, response: eventAttendees.response })
      .from(eventAttendees)
      .where(inArray(eventAttendees.eventId, eventIds.slice(i, i + CHUNK)));
    for (const r of rows) {
      const list = byEvent.get(r.eventId) ?? [];
      list.push({ userId: r.userId, response: r.response });
      byEvent.set(r.eventId, list);
    }
  }
  return byEvent;
}

/**
 * 表の 1 行を、カレンダーの項目の形にする。
 * @param row 予定の表の 1 行
 * @param attendees その予定の参加者
 * @param userId 項目を読む人。その人の返事を myResponse に入れる
 */
export function toCalendarItem(row: EventRow, attendees: Attendee[], userId: string): CalendarItem {
  // 作った人を先頭にする。作った人の返事は、行が無くても参加するとみなす
  const sorted = [...attendees].sort((a, b) => Number(b.userId === row.createdBy) - Number(a.userId === row.createdBy));
  const mine = sorted.find((a) => a.userId === userId)?.response ?? (row.createdBy === userId ? "accepted" : undefined);
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
    attendees: sorted,
    ...(mine ? { myResponse: mine } : {}),
  };
}

/**
 * 期間にかかる予定を返す。終わりが期間に入るか、終わりが無く始まりが期間に入るもの。
 * グループの予定は、招待されていないメンバーにも出す。返事は ctx の人のものを付ける。
 * @param db D1 を包んだ Drizzle
 * @param groupIds 呼んでよいグループ
 * @param from 期間の始まり
 * @param to 期間の終わり。含まない
 * @param ctx 項目を呼ぶ人
 */
export async function listEvents(
  db: DB,
  groupIds: string[],
  from: number,
  to: number,
  ctx: CalendarContext,
): Promise<CalendarItem[]> {
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
  const attendees = await loadAttendees(
    db,
    rows.map((r) => r.id),
  );
  return rows.map((r) => toCalendarItem(r, attendees.get(r.id) ?? [], ctx.userId));
}
