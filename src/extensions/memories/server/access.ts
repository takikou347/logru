import { and, eq, inArray } from "drizzle-orm";
import { HttpError } from "../../../server/core/app";
import type { DB } from "../../../server/core/db/client";
import { groupExtensions, groupMembers } from "../../../server/core/db/schema";
import { memoriesManifest } from "../manifest";

/**
 * そのグループのメンバーで、思い出の拡張が有効かを確かめる。違えば 404。
 * 無効にしたグループのデータは消さないが、見せない。F-125
 * @param db D1 を包んだ Drizzle
 * @param userId 利用者の ID
 * @param groupId グループの ID
 */
export async function requireMemoriesGroup(db: DB, userId: string, groupId: string): Promise<void> {
  const ok = await usableGroupIds(db, userId, [groupId]);
  if (ok.length === 0) throw new HttpError(404, "見つかりません。");
}

/**
 * 利用者が入っていて、思い出の拡張が有効なグループの ID。
 * @param db D1 を包んだ Drizzle
 * @param userId 利用者の ID
 * @param only 絞るグループ。省くと全部
 */
export async function usableGroupIds(db: DB, userId: string, only?: string[]): Promise<string[]> {
  if (only && only.length === 0) return [];
  const rows = await db
    .select({ id: groupMembers.groupId })
    .from(groupMembers)
    .innerJoin(
      groupExtensions,
      and(
        eq(groupExtensions.groupId, groupMembers.groupId),
        eq(groupExtensions.extensionKey, memoriesManifest.key),
        eq(groupExtensions.enabled, true),
      ),
    )
    .where(and(eq(groupMembers.userId, userId), only ? inArray(groupMembers.groupId, only) : undefined));
  return rows.map((r) => r.id);
}
