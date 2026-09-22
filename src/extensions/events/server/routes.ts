import { zValidator } from "@hono/zod-validator";
import { createRouter, HttpError, validationHook } from "@server/core/app";
import { requireAgreement, requireUser } from "@server/core/auth/middleware";
import type { DB } from "@server/core/db/client";
import { groupMembers } from "@server/core/db/schema";
import { notify } from "@server/core/notifications/send";
import { requireMembership } from "@server/modules/groups/membership";
import { and, eq, inArray } from "drizzle-orm";
import { canDeleteEvent, canEditEvent, canRespond, diffAttendees, inviteeIds } from "../shared/permissions";
import { eventInput, eventPatchInput, responseInput } from "../shared/schemas";
import { loadAttendees, toCalendarItem } from "./provider";
import { eventAttendees, events } from "./schema";

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
 * `/api/events`。予定を作る、読む、直す、消す、招待に返事をする。#28
 *
 * 読めるのは、予定のグループのメンバー。
 * 直せるのは、作った人と招待された人。消せるのは、作った人だけ。
 * 返事を返せるのは、作った人を除く、招待された人。
 */
export const eventRoutes = createRouter()
  .use("*", requireUser, requireAgreement)
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
    return c.json(await reload(db, userId, current.id));
  })
  .put("/:id/response", zValidator("json", responseInput, validationHook), async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const { row, attendees } = await loadEvent(db, userId, c.req.param("id"));
    if (!canRespond({ createdBy: row.createdBy, attendees }, userId)) {
      throw new HttpError(403, "返事ができるのは、この予定に招待された人だけです。");
    }
    const response = c.req.valid("json").response;
    await db
      .update(eventAttendees)
      .set({ response, respondedAt: new Date() })
      .where(and(eq(eventAttendees.eventId, row.id), eq(eventAttendees.userId, userId)));
    // 招待した人に「参加する」が返ったときだけ知らせる。作った人自身の返事や「参加しない」は積まない。0017、#32
    if (response === "accepted" && row.createdBy && row.createdBy !== userId) {
      await notify(db, [row.createdBy], "events.invite_accepted", {
        eventId: row.id,
        title: row.title,
        byUserId: userId,
      });
    }
    return c.json(await reload(db, userId, row.id));
  })
  .delete("/:id", async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const { row, attendees } = await loadEvent(db, userId, c.req.param("id"));
    if (!canDeleteEvent({ createdBy: row.createdBy, attendees }, userId)) {
      throw new HttpError(403, "予定を消せるのは、作った人だけです。招待された人は「参加しない」を返してください。");
    }
    await db.delete(events).where(eq(events.id, row.id));
    return c.body(null, 204);
  });
