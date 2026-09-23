/**
 * 拡張を呼んでよいグループを読み、呼ぶ。カレンダー(0008)と検索(0046)が同じ形で使う。
 */
import { serverExtensions } from "@extensions/server/registry";
import type { DB } from "@server/core/db/client";
import { groupExtensions, groupMembers, groups } from "@server/core/db/schema";
import { resolveExtensionGroupIds } from "@server/core/extension-access";
import { and, eq, inArray } from "drizzle-orm";

/**
 * 利用者の自分だけのグループの ID と、有効にした拡張の行から、拡張ごとに呼んでよいグループを求める。
 * 切り替えられる拡張が無ければ、どちらも問い合わせない。
 * @param db D1 を包んだ Drizzle
 * @param groupIds 利用者が入っていて、呼んでよいグループ
 * @param userId 利用者の ID
 */
export async function loadExtensionAccess(db: DB, groupIds: string[], userId: string): Promise<Map<string, string[]>> {
  const toggles = serverExtensions.filter((x) => !x.manifest.alwaysOn);
  const personal = toggles.length
    ? await db
        .select({ id: groups.id })
        .from(groupMembers)
        .innerJoin(groups, eq(groups.id, groupMembers.groupId))
        .where(and(eq(groupMembers.userId, userId), eq(groups.isPersonal, true)))
        .get()
    : undefined;
  const enabled = toggles.length
    ? await db
        .select()
        .from(groupExtensions)
        .where(
          and(
            inArray(groupExtensions.groupId, personal ? [...groupIds, personal.id] : groupIds),
            eq(groupExtensions.enabled, true),
          ),
        )
    : [];
  return resolveExtensionGroupIds(
    serverExtensions.map((x) => x.manifest),
    groupIds,
    personal?.id,
    enabled,
  );
}

/**
 * 呼んでよいグループが無い拡張は呼ばず、あるものだけ並べて待つ。
 * @param groupIdsByExt loadExtensionAccess が返した、拡張ごとに呼んでよいグループ
 * @param call 拡張と、その拡張へ渡すグループを受け取り、項目を返す
 */
export async function callExtensions<T>(
  groupIdsByExt: Map<string, string[]>,
  call: (ext: (typeof serverExtensions)[number], ids: string[]) => Promise<T[]>,
): Promise<T[]> {
  const results = await Promise.all(
    serverExtensions.map((x) => {
      const ids = groupIdsByExt.get(x.manifest.key) ?? [];
      return ids.length ? call(x, ids) : Promise.resolve([]);
    }),
  );
  return results.flat();
}
