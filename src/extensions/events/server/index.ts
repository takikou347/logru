import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "../../../server/core/db/client";
import type { ServerExtension } from "../../types";
import { eventsManifest } from "../manifest";
import { listEvents } from "./provider";
import { eventRoutes } from "./routes";
import * as schema from "./schema";

/**
 * グループを抜けた人を、そのグループの予定の参加者から外す。#28
 * 作った予定そのものは、グループの予定として残す。
 */
async function removeFromGroupEvents(db: DB, groupId: string, userId: string) {
  const inGroup = db.select({ id: schema.events.id }).from(schema.events).where(eq(schema.events.groupId, groupId));
  await db
    .delete(schema.eventAttendees)
    .where(and(eq(schema.eventAttendees.userId, userId), inArray(schema.eventAttendees.eventId, inGroup)));
}

/** 予定の拡張のサーバー側 */
export const eventsServer: ServerExtension = {
  manifest: eventsManifest,
  schema,
  listCalendarItems: listEvents as ServerExtension["listCalendarItems"],
  routes: { basePath: "/events", router: eventRoutes as never },
  onMemberLeave: removeFromGroupEvents as ServerExtension["onMemberLeave"],
};
