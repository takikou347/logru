import { HttpError } from "@server/core/app";
import type { DB } from "@server/core/db/client";
import { groupExtensions, groupMembers, groups } from "@server/core/db/schema";
import { and, eq } from "drizzle-orm";
import { kakeiboManifest } from "../manifest";

/** 使えるグループ 1 つ */
export type UsableGroup = { id: string; isPersonal: boolean };

/**
 * 利用者が家計簿に使えるグループ。0019
 *
 * 使うかどうかは、自分だけのグループの切り替えで持つ。使わないなら、どのグループも使えない。
 * 使うなら、自分だけのグループと、家計簿を有効にした共有のグループ。自分だけのグループは「自分だけ」に当たる。
 *
 * @param db D1 を包んだ Drizzle
 * @param userId 利用者の ID
 * @param only 絞るグループ。省くと全部
 */
export async function usableGroups(db: DB, userId: string, only?: string[]): Promise<UsableGroup[]> {
  if (only && only.length === 0) return [];
  const rows = await db
    .select({ id: groupMembers.groupId, isPersonal: groups.isPersonal })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .innerJoin(
      groupExtensions,
      and(
        eq(groupExtensions.groupId, groupMembers.groupId),
        eq(groupExtensions.extensionKey, kakeiboManifest.key),
        eq(groupExtensions.enabled, true),
      ),
    )
    .where(eq(groupMembers.userId, userId));
  if (!rows.some((r) => r.isPersonal)) return [];
  return only ? rows.filter((r) => only.includes(r.id)) : rows;
}

/** 利用者が家計簿に使えるグループの ID。usableGroups の ID だけを返す形 */
export async function usableGroupIds(db: DB, userId: string, only?: string[]): Promise<string[]> {
  return (await usableGroups(db, userId, only)).map((g) => g.id);
}

/**
 * そのグループのメンバーで、家計簿の拡張が有効かを確かめる。違えば 404。
 * 無効にしたグループのデータは消さないが、見せない。F-308
 * @param db D1 を包んだ Drizzle
 * @param userId 利用者の ID
 * @param groupId グループの ID
 */
export async function requireKakeiboGroup(db: DB, userId: string, groupId: string): Promise<void> {
  const ok = await usableGroupIds(db, userId, [groupId]);
  if (ok.length === 0) throw new HttpError(404, "見つかりません。");
}

/**
 * そのグループのメンバーの ID。家計簿を使っているかどうかは問わない。立て替えを割る相手は、
 * 記録したときのグループのメンバー全員。0072、F-318
 */
export async function groupMemberIds(db: DB, groupId: string): Promise<string[]> {
  const rows = await db.select({ id: groupMembers.userId }).from(groupMembers).where(eq(groupMembers.groupId, groupId));
  return rows.map((r) => r.id);
}
