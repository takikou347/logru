import { and, eq } from "drizzle-orm";
import type { DB } from "../../../server/core/db/client";
import type { ServerExtension } from "../../types.server";
import { memoriesManifest } from "../manifest";
import { listMemoryItems } from "./provider";
import { memoryRoutes } from "./routes";
import { notifyKoma } from "./koma";
import { cleanUpPhotos } from "./scheduled";
import * as schema from "./schema";

/**
 * グループを抜けた人の、そのグループにつないだひとコマの日を外す。これからの知らせが止まる。
 * 記録と写真は、グループの記録として残す。
 */
async function leaveKomaDays(db: DB, groupId: string, userId: string) {
  await db.delete(schema.memoryKomaDays).where(and(eq(schema.memoryKomaDays.groupId, groupId), eq(schema.memoryKomaDays.userId, userId)));
}

/** 思い出の拡張のサーバー側 */
export const memoriesServer: ServerExtension = {
  manifest: memoriesManifest,
  schema,
  listCalendarItems: listMemoryItems,
  routes: { basePath: "/memories", router: memoryRoutes },
  scheduled: async (db, env) => {
    await notifyKoma(db, env);
    await cleanUpPhotos(db, env);
  },
  onMemberLeave: leaveKomaDays,
};
