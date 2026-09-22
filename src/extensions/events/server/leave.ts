import type { DB } from "@server/core/db/client";
import { and, eq, inArray } from "drizzle-orm";
import { eventAttendees, events } from "./schema";

/**
 * グループを抜けた人を、そのグループの予定の参加者から外す。#28
 * 作った予定そのものは、グループの予定として残す。
 */
export async function removeFromGroupEvents(db: DB, groupId: string, userId: string) {
  const inGroup = db.select({ id: events.id }).from(events).where(eq(events.groupId, groupId));
  await db
    .delete(eventAttendees)
    .where(and(eq(eventAttendees.userId, userId), inArray(eventAttendees.eventId, inGroup)));
}
