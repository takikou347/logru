import type { CalendarContext } from "@extensions/server/types";
import type { DB } from "@server/core/db/client";
import type { Attendee, CalendarItem, RepeatRule as ClientRepeatRule } from "@shared/api-types";
import { and, gte, inArray, isNotNull, isNull, like, lt, or } from "drizzle-orm";
import { expandOccurrences, type RepeatRule, repeatRuleOf } from "./repeat";
import { type EventOccurrenceEditRow, type EventRow, eventAttendees, eventOccurrenceEdits, events } from "./schema";

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
 * 予定ごとの、直した・取り消した回を読む。回の始まり(occurrence_at)で引ける形にする。0043
 * @param db D1 を包んだ Drizzle
 * @param eventIds 繰り返す予定の ID
 */
async function loadOccurrenceEdits(
  db: DB,
  eventIds: string[],
): Promise<Map<string, Map<number, EventOccurrenceEditRow>>> {
  const byEvent = new Map<string, Map<number, EventOccurrenceEditRow>>();
  if (eventIds.length === 0) return byEvent;
  for (let i = 0; i < eventIds.length; i += CHUNK) {
    const rows = await db
      .select()
      .from(eventOccurrenceEdits)
      .where(inArray(eventOccurrenceEdits.eventId, eventIds.slice(i, i + CHUNK)));
    for (const r of rows) {
      const byOccurrence = byEvent.get(r.eventId) ?? new Map<number, EventOccurrenceEditRow>();
      byOccurrence.set(r.occurrenceAt.getTime(), r);
      byEvent.set(r.eventId, byOccurrence);
    }
  }
  return byEvent;
}

/** サーバーの繰り返しの規則を、画面へ返す形にする */
function repeatRuleToClient(rule: RepeatRule | null): ClientRepeatRule | undefined {
  if (!rule) return undefined;
  return {
    freq: rule.freq,
    daysOfWeek: rule.daysOfWeek ?? undefined,
    until: rule.until ? rule.until.getTime() : null,
    count: rule.count ?? null,
  };
}

/**
 * 表の 1 行を、カレンダーの項目の形にする。繰り返す予定でも、規則そのもの(直す前の 1 件)を返す。
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
    repeat: repeatRuleToClient(repeatRuleOf(row)),
  };
}

/**
 * 繰り返す予定の 1 回を、カレンダーの項目の形にする。0043
 * @param row 予定の表の 1 行
 * @param occurrenceAt この回の、規則どおりの始まりの時刻
 * @param edit この回を直した・取り消した行。無ければ規則どおり
 * @param attendees その予定の参加者。回によらず、予定に 1 つ
 * @param userId 項目を読む人
 */
export function toOccurrenceItem(
  row: EventRow,
  occurrenceAt: number,
  edit: EventOccurrenceEditRow | undefined,
  attendees: Attendee[],
  userId: string,
): CalendarItem {
  const duration = row.endsAt ? row.endsAt.getTime() - row.startsAt.getTime() : null;
  const startsAt = edit?.startsAt ? edit.startsAt.getTime() : occurrenceAt;
  const endsAt = edit?.endsAt ? edit.endsAt.getTime() : duration != null ? occurrenceAt + duration : null;
  const base = toCalendarItem(row, attendees, userId);
  return {
    ...base,
    startsAt,
    endsAt,
    allDay: edit?.allDay ?? row.allDay,
    title: edit?.title ?? row.title,
    memo: edit?.memo ?? row.memo,
    occurrenceAt,
  };
}

/**
 * 繰り返す予定の、期間に見える回を返す。取り消した回(cancelled)は含めない。
 * D1 を読まない純粋な計算で、直した・取り消した回の重なりだけを扱う。0043
 * @param row 予定の表の 1 行
 * @param edits この予定の、直した・取り消した回。occurrence_at で引ける形
 * @param from 期間の始まり
 * @param to 期間の終わり。含まない
 */
export function occurrencesFor(
  row: Pick<EventRow, "startsAt" | "repeatFreq" | "repeatDaysOfWeek" | "repeatUntil" | "repeatCount">,
  edits: Map<number, EventOccurrenceEditRow> | undefined,
  from: number,
  to: number,
): { occurrenceAt: number; edit: EventOccurrenceEditRow | undefined }[] {
  const rule = repeatRuleOf(row);
  if (!rule) return [];
  const out: { occurrenceAt: number; edit: EventOccurrenceEditRow | undefined }[] = [];
  for (const occurrenceAt of expandOccurrences(row.startsAt, rule, from, to)) {
    const edit = edits?.get(occurrenceAt);
    if (edit?.cancelled) continue;
    out.push({ occurrenceAt, edit });
  }
  return out;
}

/**
 * 期間にかかる予定を返す。終わりが期間に入るか、終わりが無く始まりが期間に入るもの。
 * 繰り返す予定は、期間に入る回だけをその場で開き、直した・取り消した回を重ねる。回は表に持たない。0043
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
  const nonRepeating = and(
    isNull(events.repeatFreq),
    or(gte(events.endsAt, new Date(from)), and(isNull(events.endsAt), gte(events.startsAt, new Date(from)))),
  );
  // 繰り返す予定は、until が期間より前で終わっていなければ候補にする。count による終わりは JS 側で絞る
  const repeating = and(
    isNotNull(events.repeatFreq),
    or(isNull(events.repeatUntil), gte(events.repeatUntil, new Date(from))),
  );
  const rows = await db
    .select()
    .from(events)
    .where(and(inArray(events.groupId, groupIds), lt(events.startsAt, new Date(to)), or(nonRepeating, repeating)));

  const attendees = await loadAttendees(
    db,
    rows.map((r) => r.id),
  );
  const repeatingIds = rows.filter((r) => r.repeatFreq).map((r) => r.id);
  const edits = await loadOccurrenceEdits(db, repeatingIds);

  const items: CalendarItem[] = [];
  for (const row of rows) {
    const rowAttendees = attendees.get(row.id) ?? [];
    const rule = repeatRuleOf(row);
    if (!rule) {
      items.push(toCalendarItem(row, rowAttendees, ctx.userId));
      continue;
    }
    const editsByOccurrence = edits.get(row.id);
    for (const { occurrenceAt, edit } of occurrencesFor(row, editsByOccurrence, from, to)) {
      items.push(toOccurrenceItem(row, occurrenceAt, edit, rowAttendees, ctx.userId));
    }
  }
  return items;
}

/**
 * 題名を探す。予定は場所を持たないので、題名だけが対象。0046
 * @param db D1 を包んだ Drizzle
 * @param groupIds 呼んでよいグループ
 * @param query 探す文字列
 * @param ctx 探す人
 */
export async function searchEvents(
  db: DB,
  groupIds: string[],
  query: string,
  ctx: CalendarContext,
): Promise<CalendarItem[]> {
  const rows = await db
    .select()
    .from(events)
    .where(and(inArray(events.groupId, groupIds), like(events.title, `%${query}%`)));
  const attendees = await loadAttendees(
    db,
    rows.map((r) => r.id),
  );
  return rows.map((r) => toCalendarItem(r, attendees.get(r.id) ?? [], ctx.userId));
}
