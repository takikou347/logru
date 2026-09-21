import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import type { CalendarItem } from "../../shared/api-types";
import { calendarQuery, eventInput, eventPatchInput } from "../../shared/schemas";
import { HttpError, createRouter, requireUser, validationHook } from "../app";
import type { DB } from "../db/client";
import { events } from "../db/schema";
import { listCalendarItems } from "../extensions/registry";
import { myGroupIds, requireMembership } from "../services/membership";

function toItem(r: typeof events.$inferSelect): CalendarItem {
  return {
    extension: "events",
    id: r.id,
    groupId: r.groupId,
    createdBy: r.createdBy,
    startsAt: r.startsAt.getTime(),
    endsAt: r.endsAt?.getTime() ?? null,
    allDay: r.allDay,
    title: r.title,
    memo: r.memo,
  };
}

async function loadEvent(db: DB, userId: string, id: string) {
  const row = await db.select().from(events).where(eq(events.id, id)).get();
  if (!row) throw new HttpError(404, "予定が見つかりません。");
  await requireMembership(db, userId, row.groupId);
  return row;
}

export const calendarRoutes = createRouter()
  .use("*", requireUser)
  .get("/", zValidator("query", calendarQuery, validationHook), async (c) => {
    const db = c.get("db");
    const { from, to, group } = c.req.valid("query");
    const mine = await myGroupIds(db, c.get("user").id);
    const wanted = group ? group.split(",").filter((g) => mine.includes(g)) : mine;
    return c.json({ items: await listCalendarItems(db, wanted, from, to) });
  });

export const eventRoutes = createRouter()
  .use("*", requireUser)
  .get("/:id", async (c) => c.json(toItem(await loadEvent(c.get("db"), c.get("user").id, c.req.param("id")))))
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
    return c.json(toItem(row), 201);
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
    return c.json(toItem(row));
  })
  .delete("/:id", async (c) => {
    const db = c.get("db");
    const current = await loadEvent(db, c.get("user").id, c.req.param("id"));
    await db.delete(events).where(eq(events.id, current.id));
    return c.body(null, 204);
  });
