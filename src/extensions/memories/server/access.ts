import { HttpError } from "@server/core/app";
import type { DB } from "@server/core/db/client";
import { groupExtensions, groupMembers, groups } from "@server/core/db/schema";
import { and, eq, inArray } from "drizzle-orm";
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
 * 利用者が思い出に使えるグループの ID。0019
 *
 * 使うかどうかは、自分だけのグループの切り替えで持つ。使わないなら、どのグループも使えない。
 * 使うなら、自分だけのグループと、思い出を有効にした共有のグループ。自分だけのグループは「共有しない」に当たる。
 *
 * @param db D1 を包んだ Drizzle
 * @param userId 利用者の ID
 * @param only 絞るグループ。省くと全部
 */
export async function usableGroupIds(db: DB, userId: string, only?: string[]): Promise<string[]> {
  if (only && only.length === 0) return [];
  const rows = await db
    .select({ id: groupMembers.groupId, isPersonal: groups.isPersonal })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .innerJoin(
      groupExtensions,
      and(
        eq(groupExtensions.groupId, groupMembers.groupId),
        eq(groupExtensions.extensionKey, memoriesManifest.key),
        eq(groupExtensions.enabled, true),
      ),
    )
    .where(eq(groupMembers.userId, userId));
  if (!rows.some((r) => r.isPersonal)) return [];
  const ids = rows.map((r) => r.id);
  return only ? ids.filter((id) => only.includes(id)) : ids;
}

/**
 * 思い出を使うと決めた人だけを残す。知らせを送る先を絞るのに使う
 * @param userIds 絞る前の人
 */
export async function usersUsingMemories(db: DB, userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const rows = await db
    .select({ id: groupMembers.userId })
    .from(groupMembers)
    .innerJoin(groups, and(eq(groups.id, groupMembers.groupId), eq(groups.isPersonal, true)))
    .innerJoin(
      groupExtensions,
      and(
        eq(groupExtensions.groupId, groups.id),
        eq(groupExtensions.extensionKey, memoriesManifest.key),
        eq(groupExtensions.enabled, true),
      ),
    )
    .where(inArray(groupMembers.userId, userIds));
  return rows.map((r) => r.id);
}
