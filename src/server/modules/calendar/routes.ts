import { serverExtensions } from "@extensions/server/registry";
import type { CalendarContext } from "@extensions/server/types";
import { zValidator } from "@hono/zod-validator";
import { createRouter, validationHook } from "@server/core/app";
import { requireAgreement, requireUser } from "@server/core/auth/middleware";
import type { DB } from "@server/core/db/client";
import { groupExtensions, groupMembers, groups } from "@server/core/db/schema";
import { myGroupIds } from "@server/modules/groups/membership";
import type { CalendarItem } from "@shared/api-types";
import { calendarQuery } from "@shared/schemas";
import { and, eq, inArray } from "drizzle-orm";

/**
 * 期間とグループを受け取り、有効な拡張の項目をまとめて日時の順に返す。0008
 *
 * カレンダーは拡張の中身を知らない。拡張ごとに、呼んでよいグループだけを渡して項目を借りる。
 * いつも有効な拡張には全部のグループを渡す。
 * 切り替えられる拡張は、その人が使うと決めたときだけ呼ぶ。使うかどうかは、自分だけのグループの切り替えで持つ。0019
 * 使うなら、自分だけのグループと、その拡張を有効にした共有のグループを渡す。
 *
 * @param db D1 を包んだ Drizzle
 * @param groupIds 利用者が入っていて、絞り込みで選んだグループ
 * @param from 期間の始まり。ミリ秒の UTC
 * @param to 期間の終わり。含まない
 * @param ctx 項目を呼ぶ人。利用者ごとの拡張は、この人の項目だけを返す
 */
async function listCalendarItems(
  db: DB,
  groupIds: string[],
  from: number,
  to: number,
  ctx: CalendarContext,
): Promise<CalendarItem[]> {
  if (groupIds.length === 0) return [];
  const toggles = serverExtensions.filter((x) => !x.manifest.alwaysOn);
  const personal = toggles.length
    ? await db
        .select({ id: groups.id })
        .from(groupMembers)
        .innerJoin(groups, eq(groups.id, groupMembers.groupId))
        .where(and(eq(groupMembers.userId, ctx.userId), eq(groups.isPersonal, true)))
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
  const used = new Set(enabled.filter((r) => r.groupId === personal?.id).map((r) => r.extensionKey));

  const results = await Promise.all(
    serverExtensions.map((x) => {
      const ids = x.manifest.alwaysOn
        ? groupIds
        : used.has(x.manifest.key)
          ? groupIds.filter(
              (g) => g === personal?.id || enabled.some((r) => r.groupId === g && r.extensionKey === x.manifest.key),
            )
          : [];
      return ids.length ? x.listCalendarItems(db, ids, from, to, ctx) : Promise.resolve([]);
    }),
  );
  return results.flat().sort((a, b) => a.startsAt - b.startsAt || a.title.localeCompare(b.title, "ja"));
}

/** `/api/calendar`。期間と、任意でグループを受け取り、カレンダーの項目を返す */
export const calendarRoutes = createRouter()
  .use("*", requireUser, requireAgreement)
  .get("/", zValidator("query", calendarQuery, validationHook), async (c) => {
    const db = c.get("db");
    const { from, to, group } = c.req.valid("query");
    const mine = await myGroupIds(db, c.get("user").id);
    // ほかの人のグループを指定されても、入っているグループだけに絞る
    const wanted = group ? group.split(",").filter((g) => mine.includes(g)) : mine;
    return c.json({ items: await listCalendarItems(db, wanted, from, to, { userId: c.get("user").id }) });
  });
