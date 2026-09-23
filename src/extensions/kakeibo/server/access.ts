import { HttpError } from "@server/core/app";
import type { DB } from "@server/core/db/client";
import { groupExtensions, groupMembers, groups } from "@server/core/db/schema";
import { and, eq } from "drizzle-orm";
import { kakeiboManifest } from "../manifest";

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
 * 利用者が家計簿に使えるグループの ID。0019
 *
 * 使うかどうかは、自分だけのグループの切り替えで持つ。使わないなら、どのグループも使えない。
 * 使うなら、自分だけのグループと、家計簿を有効にした共有のグループ。自分だけのグループは「自分だけ」に当たる。
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
        eq(groupExtensions.extensionKey, kakeiboManifest.key),
        eq(groupExtensions.enabled, true),
      ),
    )
    .where(eq(groupMembers.userId, userId));
  if (!rows.some((r) => r.isPersonal)) return [];
  const ids = rows.map((r) => r.id);
  return only ? ids.filter((id) => only.includes(id)) : ids;
}
