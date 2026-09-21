import { and, eq, inArray } from "drizzle-orm";
import type { GroupSummary } from "../../../shared/api-types";
import { HttpError } from "../../core/app";
import type { DB } from "../../core/db/client";
import { groupMembers, groups, userSettings, users } from "../../core/db/schema";

/**
 * 利用者が入っているグループの ID を返す。
 * @param db D1 を包んだ Drizzle
 * @param userId 利用者の ID
 */
export async function myGroupIds(db: DB, userId: string): Promise<string[]> {
  const rows = await db.select({ id: groupMembers.groupId }).from(groupMembers).where(eq(groupMembers.userId, userId));
  return rows.map((r) => r.id);
}

/**
 * 2 人が同じグループに入っているかを返す。自分どうしなら、自分だけのグループがあるので true。
 * @param db D1 を包んだ Drizzle
 * @param userId 利用者の ID
 * @param targetId 相手の ID
 */
export async function sharesGroup(db: DB, userId: string, targetId: string): Promise<boolean> {
  const groupIds = await myGroupIds(db, userId);
  if (groupIds.length === 0) return false;
  const row = await db
    .select({ id: groupMembers.userId })
    .from(groupMembers)
    .where(and(inArray(groupMembers.groupId, groupIds), eq(groupMembers.userId, targetId)))
    .get();
  return row !== undefined;
}

/**
 * グループのメンバーかを確かめ、役割とグループの種類を返す。
 * 入っていなければ、グループがあるかどうかも伝えないよう 404 にする。
 *
 * @param db D1 を包んだ Drizzle
 * @param userId 利用者の ID
 * @param groupId グループの ID
 * @param needAdmin 管理者に限るなら true。管理者でなければ 403
 */
export async function requireMembership(db: DB, userId: string, groupId: string, needAdmin = false) {
  const row = await db
    .select({ role: groupMembers.role, isPersonal: groups.isPersonal, name: groups.name })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .get();
  if (!row) throw new HttpError(404, "グループが見つかりません。");
  if (needAdmin && row.role !== "admin") throw new HttpError(403, "管理者だけができる操作です。");
  return row;
}

/**
 * 利用者が入っているグループを、メンバーと一緒に返す。自分だけのグループが先頭。
 * 自分だけのグループの色は、その人の「自分の色」に従う。
 *
 * @param db D1 を包んだ Drizzle
 * @param userId 利用者の ID
 */
export async function listGroups(db: DB, userId: string): Promise<GroupSummary[]> {
  const mine = await db
    .select({ group: groups, role: groupMembers.role })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, userId));
  if (mine.length === 0) return [];

  const members = await db
    .select({
      groupId: groupMembers.groupId,
      id: users.id,
      name: users.name,
      role: groupMembers.role,
      userColor: userSettings.userColor,
    })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .leftJoin(userSettings, eq(userSettings.userId, users.id))
    .where(
      inArray(
        groupMembers.groupId,
        mine.map((m) => m.group.id),
      ),
    );
  const mySettings = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();

  return mine
    .map(({ group, role }) => ({
      id: group.id,
      name: group.name,
      color: group.isPersonal ? (mySettings?.userColor ?? group.color) : group.color,
      isPersonal: group.isPersonal,
      role,
      members: members
        .filter((m) => m.groupId === group.id)
        .map((m) => ({ id: m.id, name: m.name, role: m.role, userColor: m.userColor ?? "wakatake" })),
    }))
    .sort((a, b) => Number(b.isPersonal) - Number(a.isPersonal) || a.name.localeCompare(b.name, "ja"));
}
