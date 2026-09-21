import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { HttpError, createRouter, validationHook } from "../../../server/core/app";
import { requireAgreement, requireUser } from "../../../server/core/auth/middleware";
import type { DB } from "../../../server/core/db/client";
import { requireMembership } from "../../../server/modules/groups/membership";
import { eventInput, eventPatchInput } from "../shared/schemas";
import { toCalendarItem } from "./provider";
import { events } from "./schema";

/** 予定を読み、そのグループのメンバーか確かめる。違えば 404 */
async function loadEvent(db: DB, userId: string, id: string) {
  const row = await db.select().from(events).where(eq(events.id, id)).get();
  if (!row) throw new HttpError(404, "予定が見つかりません。");
  await requireMembership(db, userId, row.groupId);
  return row;
}

/** `/api/events`。予定を作る、読む、直す、消す。そのグループのメンバーだけができる */
export const eventRoutes = createRouter()
  .use("*", requireUser, requireAgreement)
  .get("/:id", async (c) => c.json(toCalendarItem(await loadEvent(c.get("db"), c.get("user").id, c.req.param("id")))))
  .post("/", zValidator("json", eventInput, validationHook), async (c) => {
    const db = c.get("db");
    const input = c.req.valid("json");
    await requireMembership(db, c.get("user").id, input.groupId);
    const row = await db
      .insert(events)
      .values({
        id: crypto.randomUUID(),
        groupId: input.groupId,
        createdBy: c.get("user").id,
        title: input.title,
        allDay: input.allDay,
        startsAt: new Date(input.startsAt),
        endsAt: input.endsAt == null ? null : new Date(input.endsAt),
        memo: input.memo || null,
      })
      .returning()
      .get();
    return c.json(toCalendarItem(row), 201);
  })
  .patch("/:id", zValidator("json", eventPatchInput, validationHook), async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const current = await loadEvent(db, userId, c.req.param("id"));
    const input = c.req.valid("json");
    if (input.groupId && input.groupId !== current.groupId) await requireMembership(db, userId, input.groupId);
    const startsAt = input.startsAt ?? current.startsAt.getTime();
    const endsAt = input.endsAt === undefined ? (current.endsAt?.getTime() ?? null) : input.endsAt;
    if (endsAt != null && endsAt < startsAt) throw new HttpError(400, "終わりは始まりより後にしてください。");
    const row = await db
      .update(events)
      .set({
        groupId: input.groupId ?? current.groupId,
        title: input.title ?? current.title,
        allDay: input.allDay ?? current.allDay,
        startsAt: new Date(startsAt),
        endsAt: endsAt == null ? null : new Date(endsAt),
        memo: input.memo === undefined ? current.memo : input.memo || null,
        updatedAt: new Date(),
      })
      .where(eq(events.id, current.id))
      .returning()
      .get();
    return c.json(toCalendarItem(row));
  })
  .delete("/:id", async (c) => {
    const db = c.get("db");
    const current = await loadEvent(db, c.get("user").id, c.req.param("id"));
    await db.delete(events).where(eq(events.id, current.id));
    return c.body(null, 204);
  });
