import type { CalendarContext } from "@extensions/server/types";
import type { DB } from "@server/core/db/client";
import { groupMembers, groups } from "@server/core/db/schema";
import type { CalendarItem } from "@shared/api-types";
import { and, eq, gte, inArray, isNull, like, lt, or } from "drizzle-orm";
import { type ExternalCalendarRow, externalCalendars, externalEvents } from "./schema";

/** 取り込んだ予定の 1 行を、カレンダーの項目の形にする */
function toCalendarItem(
  event: typeof externalEvents.$inferSelect,
  calendar: Pick<ExternalCalendarRow, "id" | "name" | "color">,
  personalGroupId: string,
  userId: string,
): CalendarItem {
  return {
    extension: "external",
    id: `${calendar.id}:${event.occurrence}:${event.uid}`,
    groupId: personalGroupId,
    createdBy: userId,
    startsAt: event.startsAt.getTime(),
    endsAt: event.endsAt?.getTime() ?? null,
    allDay: event.allDay,
    title: event.title,
    memo: null,
    place: event.location ?? undefined,
    color: calendar.color,
    sourceName: calendar.name,
  };
}

/** 自分だけのグループの ID。groupIds に含まれず、見えないなら null */
async function myPersonalGroupId(db: DB, groupIds: string[], userId: string): Promise<string | null> {
  const personal = await db
    .select({ id: groups.id })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(and(eq(groupMembers.userId, userId), eq(groups.isPersonal, true), inArray(groups.id, groupIds)))
    .get();
  return personal?.id ?? null;
}

/**
 * 期間にかかる、取り込んだ予定を返す。登録した本人にだけ返す。
 *
 * 項目は本人の自分だけのグループに置く。グループで絞ったときに、自分だけのグループを選んでいなければ返さない。
 * 色は、登録したときに選んだカレンダーの色。
 *
 * @param groupIds 呼んでよいグループ
 * @param from 期間の始まり
 * @param to 期間の終わり。含まない
 * @param ctx 呼ぶ人
 */
export async function listExternalEvents(
  db: DB,
  groupIds: string[],
  from: number,
  to: number,
  ctx: CalendarContext,
): Promise<CalendarItem[]> {
  if (groupIds.length === 0) return [];
  const personalId = await myPersonalGroupId(db, groupIds, ctx.userId);
  if (!personalId) return [];

  const rows = await db
    .select({
      event: externalEvents,
      calendar: { id: externalCalendars.id, name: externalCalendars.name, color: externalCalendars.color },
    })
    .from(externalEvents)
    .innerJoin(externalCalendars, eq(externalCalendars.id, externalEvents.calendarId))
    .where(
      and(
        eq(externalCalendars.userId, ctx.userId),
        lt(externalEvents.startsAt, new Date(to)),
        or(
          gte(externalEvents.endsAt, new Date(from)),
          and(isNull(externalEvents.endsAt), gte(externalEvents.startsAt, new Date(from))),
        ),
      ),
    );

  return rows.map(({ event, calendar }) => toCalendarItem(event, calendar, personalId, ctx.userId));
}

/**
 * 取り込んだ予定の題名と場所を探す。登録した本人にだけ返す。0046
 * @param db D1 を包んだ Drizzle
 * @param groupIds 呼んでよいグループ
 * @param query 探す文字列
 * @param ctx 探す人
 */
export async function searchExternalEvents(
  db: DB,
  groupIds: string[],
  query: string,
  ctx: CalendarContext,
): Promise<CalendarItem[]> {
  if (groupIds.length === 0) return [];
  const personalId = await myPersonalGroupId(db, groupIds, ctx.userId);
  if (!personalId) return [];

  const pattern = `%${query}%`;
  const rows = await db
    .select({
      event: externalEvents,
      calendar: { id: externalCalendars.id, name: externalCalendars.name, color: externalCalendars.color },
    })
    .from(externalEvents)
    .innerJoin(externalCalendars, eq(externalCalendars.id, externalEvents.calendarId))
    .where(
      and(
        eq(externalCalendars.userId, ctx.userId),
        or(like(externalEvents.title, pattern), like(externalEvents.location, pattern)),
      ),
    );

  return rows.map(({ event, calendar }) => toCalendarItem(event, calendar, personalId, ctx.userId));
}
