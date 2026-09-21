import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray } from "drizzle-orm";
import type { CalendarItem } from "../../../shared/api-types";
import { calendarQuery } from "../../../shared/schemas";
import { serverExtensions } from "../../../extensions/registry.server";
import { createRouter, validationHook } from "../../core/app";
import { requireAgreement, requireUser } from "../../core/auth/middleware";
import type { DB } from "../../core/db/client";
import { groupExtensions } from "../../core/db/schema";
import { myGroupIds } from "../groups/membership";

/**
 * 期間とグループを受け取り、有効な拡張の項目をまとめて日時の順に返す。0008
 *
 * カレンダーは拡張の中身を知らない。拡張ごとに、呼んでよいグループだけを渡して項目を借りる。
 * いつも有効な拡張には全部のグループを、そうでない拡張には有効にしたグループだけを渡す。
 *
 * @param db D1 を包んだ Drizzle
 * @param groupIds 利用者が入っていて、絞り込みで選んだグループ
 * @param from 期間の始まり。ミリ秒の UTC
 * @param to 期間の終わり。含まない
 */
export async function listCalendarItems(db: DB, groupIds: string[], from: number, to: number): Promise<CalendarItem[]> {
  if (groupIds.length === 0) return [];
  const toggles = serverExtensions.filter((x) => !x.manifest.alwaysOn);
  const enabled = toggles.length
    ? await db
        .select()
        .from(groupExtensions)
        .where(and(inArray(groupExtensions.groupId, groupIds), eq(groupExtensions.enabled, true)))
    : [];

  const results = await Promise.all(
    serverExtensions.map((x) => {
      const ids = x.manifest.alwaysOn
        ? groupIds
        : enabled.filter((r) => r.extensionKey === x.manifest.key).map((r) => r.groupId);
      return ids.length ? x.listCalendarItems(db as never, ids, from, to) : Promise.resolve([]);
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
    return c.json({ items: await listCalendarItems(db, wanted, from, to) });
  });
