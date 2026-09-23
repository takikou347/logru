import type { ServerExtension } from "@extensions/server/types";
import type { DB } from "@server/core/db/client";
import { and, eq, sql } from "drizzle-orm";
import { memoriesManifest } from "../manifest";
import { notifyKoma } from "./koma";
import { listMemoryItems, searchMemories } from "./provider";
import { memoryRoutes } from "./routes";
import { cleanUpPhotos } from "./scheduled";
import * as schema from "./schema";

/**
 * グループを抜けた人の、そのグループにつないだひとコマの日を外す。これからの知らせが止まる。
 * 記録と写真は、グループの記録として残す。
 */
async function leaveKomaDays(db: DB, groupId: string, userId: string) {
  await db
    .delete(schema.memoryKomaDays)
    .where(and(eq(schema.memoryKomaDays.groupId, groupId), eq(schema.memoryKomaDays.userId, userId)));
}

/** 写真の full と thumb の合計バイト数。R2 の合計の上限を測るのに使う。R2 には聞かず、D1 の bytes の列だけで測る。0066 */
async function totalPhotoBytes(db: DB): Promise<number> {
  const row = await db
    .select({ total: sql<number>`coalesce(sum(${schema.memoryPhotos.bytes}), 0)` })
    .from(schema.memoryPhotos)
    .get();
  return row?.total ?? 0;
}

/** 思い出の拡張のサーバー側 */
export const memoriesServer: ServerExtension = {
  manifest: memoriesManifest,
  schema,
  listCalendarItems: listMemoryItems,
  search: searchMemories,
  routes: { basePath: "/memories", router: memoryRoutes },
  scheduled: async (db, env) => {
    await notifyKoma(db, env);
    await cleanUpPhotos(db, env);
  },
  onMemberLeave: leaveKomaDays,
  storageBytes: totalPhotoBytes,
};
