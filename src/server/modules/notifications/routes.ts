import { createRouter, HttpError } from "@server/core/app";
import { requireAgreement, requireUser } from "@server/core/auth/middleware";
import type { DB } from "@server/core/db/client";
import { notifications } from "@server/core/db/schema";
import type { NotificationItem, NotificationPage } from "@shared/api-types";
import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { buildPage, NOTIFICATIONS_PAGE_SIZE } from "./pagination";

type NotificationRow = typeof notifications.$inferSelect;

function toItem(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    kind: row.kind,
    payload: row.payload as Record<string, unknown>,
    readAt: row.readAt?.getTime() ?? null,
    createdAt: row.createdAt.getTime(),
  };
}

/** 自分のお知らせを 1 件読み、無ければ 404 */
async function loadOwn(db: DB, userId: string, id: string): Promise<NotificationRow> {
  const row = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .get();
  if (!row) throw new HttpError(404, "見つかりません。");
  return row;
}

/**
 * `/api/notifications`。お知らせの一覧、未読の数、既読にする。#32
 *
 * 読めるのは自分に積まれたものだけ。where に自分の userId をいつも付けるので、他人のものは読めず、既読にもできない。
 */
export const notificationRoutes = createRouter()
  .use("*", requireUser, requireAgreement)
  .get("/", async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const cursor = c.req.query("cursor");
    const cursorDate = cursor ? new Date(Number(cursor)) : null;
    const where = cursorDate
      ? and(eq(notifications.userId, me.id), lt(notifications.createdAt, cursorDate))
      : eq(notifications.userId, me.id);
    const rows = await db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(NOTIFICATIONS_PAGE_SIZE + 1);
    const { items, nextCursor } = buildPage(rows);
    const body: NotificationPage = { items: items.map(toItem), nextCursor };
    return c.json(body);
  })
  .get("/unread-count", async (c) => {
    const rows = await c
      .get("db")
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, c.get("user").id), isNull(notifications.readAt)));
    return c.json({ count: rows.length });
  })
  .put("/:id/read", async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const row = await loadOwn(db, me.id, c.req.param("id"));
    if (!row.readAt) await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.id, row.id));
    return c.body(null, 204);
  })
  .put("/read-all", async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, me.id), isNull(notifications.readAt)));
    return c.body(null, 204);
  });
