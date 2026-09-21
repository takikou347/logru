import { and, eq, inArray } from "drizzle-orm";
import { HttpError } from "../app";
import type { DB } from "../db/client";
import { groupMembers, groups, user, userSettings } from "../db/schema";
import type { GroupSummary } from "../../shared/api-types";

export async function myGroupIds(db: DB, userId: string): Promise<string[]> {
  const rows = await db.select({ id: groupMembers.groupId }).from(groupMembers).where(eq(groupMembers.userId, userId));
  return rows.map((r) => r.id);
}

/** 所属を確かめる。管理者に限るなら admin を渡す */
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

export async function listGroups(db: DB, userId: string): Promise<GroupSummary[]> {
  const mine = await db
    .select({ group: groups, role: groupMembers.role })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, userId));
  if (mine.length === 0) return [];
  const ids = mine.map((m) => m.group.id);
  const members = await db
    .select({
      groupId: groupMembers.groupId,
      id: user.id,
      name: user.name,
      role: groupMembers.role,
      userColor: userSettings.userColor,
    })
    .from(groupMembers)
    .innerJoin(user, eq(user.id, groupMembers.userId))
    .leftJoin(userSettings, eq(userSettings.userId, user.id))
    .where(inArray(groupMembers.groupId, ids));

  const mySettings = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();

  return mine
    .map(({ group, role }) => ({
      id: group.id,
      name: group.name,
      // 自分だけのグループは自分の色に従う
      color: group.isPersonal ? (mySettings?.userColor ?? group.color) : group.color,
      isPersonal: group.isPersonal,
      role,
      members: members
        .filter((m) => m.groupId === group.id)
        .map((m) => ({ id: m.id, name: m.name, role: m.role, userColor: m.userColor ?? "wakatake" })),
    }))
    .sort((a, b) => Number(b.isPersonal) - Number(a.isPersonal) || a.name.localeCompare(b.name, "ja"));
}
