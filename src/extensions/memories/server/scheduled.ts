import type { DB } from "@server/core/db/client";
import { and, asc, inArray, isNull, lt } from "drizzle-orm";
import { memoryPhotos, memoryPhotoTrash } from "./schema";

/** 1 回の定期の処理で R2 から消す鍵の数 */
const TRASH_PER_RUN = 100;

/** 記録に付かないまま、この時間がたった写真を消す。24 時間 */
const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * 思い出の拡張の定期の処理。土台が 5 分おきに呼ぶ。0021
 *
 * 1. 記録に付かないまま 24 時間たった写真の行を消す。トリガーが R2 の鍵を積む
 * 2. 消す待ちの鍵を、古い順に 100 件まで R2 から消し、行を消す
 *
 * @param db D1 を包んだ Drizzle
 * @param env Worker の環境変数
 */
export async function cleanUpPhotos(db: DB, env: Env): Promise<void> {
  await db
    .delete(memoryPhotos)
    .where(and(isNull(memoryPhotos.recordId), lt(memoryPhotos.createdAt, new Date(Date.now() - ORPHAN_AGE_MS))));
  const trash = await db.select().from(memoryPhotoTrash).orderBy(asc(memoryPhotoTrash.deletedAt)).limit(TRASH_PER_RUN);
  if (trash.length === 0) return;
  const keys = trash.map((t) => t.key);
  await env.MEMORIES_BUCKET.delete(keys);
  await db.delete(memoryPhotoTrash).where(inArray(memoryPhotoTrash.key, keys));
}
