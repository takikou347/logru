import { zValidator } from "@hono/zod-validator";
import { createRouter, HttpError, validationHook } from "@server/core/app";
import { requireAgreement, requireUser } from "@server/core/auth/middleware";
import type { DB } from "@server/core/db/client";
import { groupMembers } from "@server/core/db/schema";
import { notify } from "@server/core/notifications/send";
import { myGroupIds, requireMembership } from "@server/modules/groups/membership";
import type { Attendee } from "@shared/api-types";
import { and, eq, inArray } from "drizzle-orm";
import {
  canDeleteEvent,
  canEditEvent,
  canRespond,
  diffAttendees,
  inviteeIds,
  shouldNotifyAccepted,
} from "../shared/permissions";
import {
  type EventDeleteInput,
  type EventPatchInput,
  eventDeleteInput,
  eventInput,
  eventPatchInput,
  type RepeatRuleInput,
  responseInput,
} from "../shared/schemas";
import { loadAttendees, toCalendarItem, toOccurrenceItem } from "./provider";
import { DAY_MS, dayBeforeUtc, nextOccurrenceOnOrAfter, repeatRuleOf } from "./repeat";
import { type EventRow, eventAttendees, eventOccurrenceEdits, events } from "./schema";

/** 予定を読み、そのグループのメンバーか確かめる。違えば 404。参加者も一緒に返す */
async function loadEvent(db: DB, userId: string, id: string) {
  const row = await db.select().from(events).where(eq(events.id, id)).get();
  if (!row) throw new HttpError(404, "予定が見つかりません。");
  await requireMembership(db, userId, row.groupId);
  const attendees = (await loadAttendees(db, [row.id])).get(row.id) ?? [];
  return { row, attendees };
}

/** 予定を、読む人の返事を付けて、もう一度読んで返す形にする */
async function reload(db: DB, userId: string, id: string) {
  const { row, attendees } = await loadEvent(db, userId, id);
  return toCalendarItem(row, attendees, userId);
}

/**
 * 招待する人が、みな予定のグループのメンバーかを確かめる。違う人がいれば 400。#28
 * @param db D1 を包んだ Drizzle
 * @param groupId 予定のグループ
 * @param ids 招待する人
 */
async function requireInvitable(db: DB, groupId: string, ids: string[]) {
  if (ids.length === 0) return;
  const rows = await db
    .select({ id: groupMembers.userId })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), inArray(groupMembers.userId, ids)));
  if (rows.length !== ids.length) throw new HttpError(400, "招待できるのは、この予定のグループのメンバーだけです。");
}

/**
 * グループのメンバーのうち、ids に入っている人だけを返す。グループを移したとき、移った先にいない人を外すのに使う
 */
async function membersAmong(db: DB, groupId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: groupMembers.userId })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), inArray(groupMembers.userId, ids)));
  return rows.map((r) => r.id);
}

/**
 * 繰り返しの入力を、events の repeat_* の列の値にする。0043
 * @param repeat 入力の repeat。undefined なら列を触らない、null なら繰り返しをやめる
 */
export function repeatColumns(repeat: RepeatRuleInput | null | undefined) {
  if (repeat === undefined) return undefined;
  if (repeat === null) {
    return { repeatFreq: null, repeatDaysOfWeek: null, repeatUntil: null, repeatCount: null };
  }
  return {
    repeatFreq: repeat.freq,
    repeatDaysOfWeek: repeat.freq === "weekly" ? (repeat.daysOfWeek ?? null) : null,
    repeatUntil: repeat.until != null ? new Date(repeat.until) : null,
    repeatCount: repeat.count ?? null,
  };
}

/**
 * 予定そのものを直す。範囲が all のときと、繰り返しのいちばん最初の回から following を選んだときに使う。0043
 * 繰り返しの規則も、入力にあれば直す。無ければいまの規則のまま。
 */
async function applyFullUpdate(
  db: DB,
  current: EventRow,
  attendees: Attendee[],
  input: EventPatchInput,
  userId: string,
) {
  const groupId = input.groupId ?? current.groupId;
  if (groupId !== current.groupId) {
    // 招待された人がグループを移すと、作った人が読めなくなることがある。移せるのは作った人だけ
    if (current.createdBy !== userId) throw new HttpError(403, "グループを変えられるのは、予定を作った人だけです。");
    await requireMembership(db, userId, groupId);
  }
  const startsAt = input.startsAt ?? current.startsAt.getTime();
  const endsAt = input.endsAt === undefined ? (current.endsAt?.getTime() ?? null) : input.endsAt;
  if (endsAt != null && endsAt < startsAt) throw new HttpError(400, "終わりは始まりより後にしてください。");

  // 招待する人。送られなければいまの顔ぶれのまま。グループを移したら、移った先にいない人を外す
  let invitees: string[];
  if (input.attendeeIds) {
    invitees = inviteeIds(input.attendeeIds, current.createdBy);
    await requireInvitable(db, groupId, invitees);
  } else {
    invitees = inviteeIds(
      attendees.map((a) => a.userId),
      current.createdBy,
    );
    if (groupId !== current.groupId) invitees = await membersAmong(db, groupId, invitees);
  }
  const { add, remove } = diffAttendees(attendees, invitees, current.createdBy);
  const now = new Date();

  await db.batch([
    db
      .update(events)
      .set({
        groupId,
        title: input.title ?? current.title,
        allDay: input.allDay ?? current.allDay,
        startsAt: new Date(startsAt),
        endsAt: endsAt == null ? null : new Date(endsAt),
        memo: input.memo === undefined ? current.memo : input.memo || null,
        updatedAt: now,
        ...repeatColumns(input.repeat),
      })
      .where(eq(events.id, current.id)),
    ...(remove.length
      ? [
          db
            .delete(eventAttendees)
            .where(and(eq(eventAttendees.eventId, current.id), inArray(eventAttendees.userId, remove))),
        ]
      : []),
    ...(add.length
      ? [
          db
            .insert(eventAttendees)
            .values(
              add.map((u) =>
                u === current.createdBy
                  ? { eventId: current.id, userId: u, response: "accepted" as const, respondedAt: now }
                  : { eventId: current.id, userId: u, response: "pending" as const },
              ),
            ),
        ]
      : []),
  ]);
  return reload(db, userId, current.id);
}

/**
 * 繰り返す予定の、この回だけを直す。event_occurrence_edits に 1 行を足すか、上書きする。0043
 * グループと招待する人は、この回だけでは変えられない。表に列が無いので、送られても無視する。
 */
async function editOccurrence(db: DB, current: EventRow, input: EventPatchInput, userId: string) {
  const occurrenceAt = input.occurrenceAt;
  if (occurrenceAt == null) throw new HttpError(400, "直す回を指定してください。");
  const duration = current.endsAt ? current.endsAt.getTime() - current.startsAt.getTime() : null;
  const startsAt = input.startsAt ?? occurrenceAt;
  const endsAt = input.endsAt !== undefined ? input.endsAt : duration != null ? startsAt + duration : null;
  if (endsAt != null && endsAt < startsAt) throw new HttpError(400, "終わりは始まりより後にしてください。");
  const values = {
    cancelled: false,
    startsAt: new Date(startsAt),
    endsAt: endsAt == null ? null : new Date(endsAt),
    allDay: input.allDay ?? current.allDay,
    title: input.title ?? current.title,
    memo: input.memo === undefined ? current.memo : input.memo || null,
  };
  await db
    .insert(eventOccurrenceEdits)
    .values({ eventId: current.id, occurrenceAt: new Date(occurrenceAt), ...values })
    .onConflictDoUpdate({ target: [eventOccurrenceEdits.eventId, eventOccurrenceEdits.occurrenceAt], set: values });
  const attendees = (await loadAttendees(db, [current.id])).get(current.id) ?? [];
  return toOccurrenceItem(
    current,
    occurrenceAt,
    { eventId: current.id, occurrenceAt: new Date(occurrenceAt), ...values },
    attendees,
    userId,
  );
}

/**
 * 繰り返す予定を、この回から先だけ直す。いまの予定をこの回の前で終わらせ、この回から新しい予定を作る。0043
 * 招待した人と返事は、変えなければそのまま写す。変えるなら、残る人の返事だけ引き継ぐ。
 */
async function splitFollowing(
  db: DB,
  current: EventRow,
  attendees: Attendee[],
  input: EventPatchInput,
  userId: string,
) {
  const occurrenceAt = input.occurrenceAt;
  if (occurrenceAt == null) throw new HttpError(400, "直す回を指定してください。");

  const groupId = input.groupId ?? current.groupId;
  if (groupId !== current.groupId && current.createdBy !== userId) {
    throw new HttpError(403, "グループを変えられるのは、予定を作った人だけです。");
  }
  if (groupId !== current.groupId) await requireMembership(db, userId, groupId);

  const duration = current.endsAt ? current.endsAt.getTime() - current.startsAt.getTime() : null;
  const startsAt = input.startsAt ?? occurrenceAt;
  const endsAt = input.endsAt !== undefined ? input.endsAt : duration != null ? startsAt + duration : null;
  if (endsAt != null && endsAt < startsAt) throw new HttpError(400, "終わりは始まりより後にしてください。");

  const newId = crypto.randomUUID();
  const inheritedRepeat = {
    repeatFreq: current.repeatFreq,
    repeatDaysOfWeek: current.repeatDaysOfWeek,
    repeatUntil: current.repeatUntil,
    repeatCount: current.repeatCount,
  };
  const newEvent = {
    id: newId,
    groupId,
    createdBy: current.createdBy,
    title: input.title ?? current.title,
    allDay: input.allDay ?? current.allDay,
    startsAt: new Date(startsAt),
    endsAt: endsAt == null ? null : new Date(endsAt),
    memo: input.memo === undefined ? current.memo : input.memo || null,
    ...(repeatColumns(input.repeat) ?? inheritedRepeat),
  };

  let attendeeRows: { eventId: string; userId: string; response: Attendee["response"]; respondedAt: Date | null }[];
  if (input.attendeeIds) {
    const invitees = inviteeIds(input.attendeeIds, current.createdBy);
    await requireInvitable(db, groupId, invitees);
    const { keep, add } = diffAttendees(attendees, invitees, current.createdBy);
    const byId = new Map(attendees.map((a) => [a.userId, a]));
    attendeeRows = [
      ...keep.map((id) => ({
        eventId: newId,
        userId: id,
        response: byId.get(id)?.response ?? "pending",
        respondedAt: id === current.createdBy ? new Date() : null,
      })),
      ...add.map((id) => ({ eventId: newId, userId: id, response: "pending" as const, respondedAt: null })),
    ];
  } else {
    attendeeRows = attendees.map((a) => ({
      eventId: newId,
      userId: a.userId,
      response: a.response,
      respondedAt: null,
    }));
    if (current.createdBy && !attendeeRows.some((a) => a.userId === current.createdBy)) {
      attendeeRows.push({ eventId: newId, userId: current.createdBy, response: "accepted", respondedAt: new Date() });
    }
  }

  await db.batch([
    db
      .update(events)
      .set({ repeatUntil: dayBeforeUtc(occurrenceAt), repeatCount: null, updatedAt: new Date() })
      .where(eq(events.id, current.id)),
    db.insert(events).values(newEvent),
    ...(attendeeRows.length ? [db.insert(eventAttendees).values(attendeeRows)] : []),
  ]);
  return reload(db, userId, newId);
}

/**
 * `/api/events`。予定を作る、読む、直す、消す、招待に返事をする。#28
 *
 * 読めるのは、予定のグループのメンバー。
 * 直せるのは、作った人と招待された人。消せるのは、作った人だけ。
 * 返事を返せるのは、作った人を除く、招待された人。
 * 繰り返す予定を直す、消すときは、この回だけ・これ以降・全部の範囲がいる。0043
 */
export const eventRoutes = createRouter()
  .use("*", requireUser, requireAgreement)
  .get("/upcoming-anniversary", async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const groupIds = await myGroupIds(db, userId);
    if (groupIds.length === 0) return c.json({ item: null });
    const rows = await db
      .select()
      .from(events)
      .where(and(inArray(events.groupId, groupIds), eq(events.repeatFreq, "yearly")));
    const now = new Date();
    // 利用者の時間帯は持たないので、UTC の暦の今日で数える。0043
    const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const windowEnd = todayStart + 7 * DAY_MS;
    let best: { id: string; title: string; occurrenceAt: number } | null = null;
    for (const row of rows) {
      const rule = repeatRuleOf(row);
      if (!rule) continue;
      const next = nextOccurrenceOnOrAfter(row.startsAt, rule, todayStart);
      if (next == null || next > windowEnd) continue;
      if (!best || next < best.occurrenceAt) best = { id: row.id, title: row.title, occurrenceAt: next };
    }
    return c.json({ item: best });
  })
  .get("/:id", async (c) => c.json(await reload(c.get("db"), c.get("user").id, c.req.param("id"))))
  .post("/", zValidator("json", eventInput, validationHook), async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const input = c.req.valid("json");
    await requireMembership(db, userId, input.groupId);
    const invitees = inviteeIds(input.attendeeIds, userId);
    await requireInvitable(db, input.groupId, invitees);
    const id = crypto.randomUUID();
    const now = new Date();
    await db.batch([
      db.insert(events).values({
        id,
        groupId: input.groupId,
        createdBy: userId,
        title: input.title,
        allDay: input.allDay,
        startsAt: new Date(input.startsAt),
        endsAt: input.endsAt == null ? null : new Date(input.endsAt),
        memo: input.memo || null,
        ...(repeatColumns(input.repeat ?? null) ?? {}),
      }),
      // 作った人は、いつも参加する
      db
        .insert(eventAttendees)
        .values([
          { eventId: id, userId, response: "accepted", respondedAt: now },
          ...invitees.map((u) => ({ eventId: id, userId: u, response: "pending" as const })),
        ]),
    ]);
    return c.json(await reload(db, userId, id), 201);
  })
  .patch("/:id", zValidator("json", eventPatchInput, validationHook), async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const { row: current, attendees } = await loadEvent(db, userId, c.req.param("id"));
    if (!canEditEvent({ createdBy: current.createdBy, attendees }, userId)) {
      throw new HttpError(403, "この予定を直せるのは、作った人と招待された人だけです。");
    }
    const input = c.req.valid("json");
    const rule = repeatRuleOf(current);
    if (rule && !input.scope) throw new HttpError(400, "繰り返す予定を直すときは、範囲を選んでください。");

    if (rule && input.scope === "this") return c.json(await editOccurrence(db, current, input, userId));
    if (rule && input.scope === "following") {
      if (input.occurrenceAt == null) throw new HttpError(400, "直す回を指定してください。");
      // いちばん最初の回からの following は、全部を直すのと同じにする
      if (input.occurrenceAt > current.startsAt.getTime()) {
        return c.json(await splitFollowing(db, current, attendees, input, userId), 201);
      }
    }
    return c.json(await applyFullUpdate(db, current, attendees, input, userId));
  })
  .put("/:id/response", zValidator("json", responseInput, validationHook), async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const { row, attendees } = await loadEvent(db, userId, c.req.param("id"));
    if (!canRespond({ createdBy: row.createdBy, attendees }, userId)) {
      throw new HttpError(403, "返事ができるのは、この予定に招待された人だけです。");
    }
    const response = c.req.valid("json").response;
    const previous = attendees.find((a) => a.userId === userId)?.response;
    await db
      .update(eventAttendees)
      .set({ response, respondedAt: new Date() })
      .where(and(eq(eventAttendees.eventId, row.id), eq(eventAttendees.userId, userId)));
    // 招待した人に「参加する」が返ったときだけ知らせる。前の答えが既に「参加する」だったときは積まない。
    // 作った人自身の返事や「参加しない」も積まない。0017、#32
    if (row.createdBy && shouldNotifyAccepted(response, previous, row.createdBy, userId)) {
      await notify(db, [row.createdBy], "events.invite_accepted", {
        eventId: row.id,
        title: row.title,
        byUserId: userId,
      });
    }
    return c.json(await reload(db, userId, row.id));
  })
  .delete("/:id", zValidator("json", eventDeleteInput, validationHook), async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const { row, attendees } = await loadEvent(db, userId, c.req.param("id"));
    if (!canDeleteEvent({ createdBy: row.createdBy, attendees }, userId)) {
      throw new HttpError(403, "予定を消せるのは、作った人だけです。招待された人は「参加しない」を返してください。");
    }
    const input: EventDeleteInput = c.req.valid("json");
    const rule = repeatRuleOf(row);
    if (!rule || input.scope === "all") {
      await db.delete(events).where(eq(events.id, row.id));
      return c.body(null, 204);
    }
    if (!input.scope) throw new HttpError(400, "繰り返す予定を消すときは、範囲を選んでください。");
    if (input.occurrenceAt == null) throw new HttpError(400, "消す回を指定してください。");

    if (input.scope === "this") {
      const values = { cancelled: true, startsAt: null, endsAt: null, allDay: null, title: null, memo: null };
      await db
        .insert(eventOccurrenceEdits)
        .values({ eventId: row.id, occurrenceAt: new Date(input.occurrenceAt), ...values })
        .onConflictDoUpdate({ target: [eventOccurrenceEdits.eventId, eventOccurrenceEdits.occurrenceAt], set: values });
      return c.body(null, 204);
    }
    // following。いちばん最初の回からなら、全部を消すのと同じにする
    if (input.occurrenceAt <= row.startsAt.getTime()) {
      await db.delete(events).where(eq(events.id, row.id));
    } else {
      await db
        .update(events)
        .set({ repeatUntil: dayBeforeUtc(input.occurrenceAt), repeatCount: null, updatedAt: new Date() })
        .where(eq(events.id, row.id));
    }
    return c.body(null, 204);
  });
