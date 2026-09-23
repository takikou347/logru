import { zValidator } from "@hono/zod-validator";
import { createRouter, validationHook } from "@server/core/app";
import { requireAgreement, requireUser } from "@server/core/auth/middleware";
import type { DB } from "@server/core/db/client";
import { callExtensions, loadExtensionAccess } from "@server/modules/calendar/access";
import { myGroupIds } from "@server/modules/groups/membership";
import type { CalendarItem } from "@shared/api-types";
import { searchQuery } from "@shared/schemas";

/** 一度に返す件数の上限。個人の記録が対象なので、この数で十分に足りる */
const LIMIT = 30;

/**
 * 題名と場所を探し、日付の新しい順にまとめて返す。0046
 *
 * カレンダーは拡張の中身を知らない。拡張ごとに、見えるグループだけを渡して探させる。0008 の listCalendarItems と同じ形。
 * @param db D1 を包んだ Drizzle
 * @param groupIds 利用者が入っているグループ
 * @param query 探す文字列
 * @param userId 探す人
 */
async function search(db: DB, groupIds: string[], query: string, userId: string): Promise<CalendarItem[]> {
  if (groupIds.length === 0) return [];
  const byExt = await loadExtensionAccess(db, groupIds, userId);
  const items = await callExtensions(byExt, (x, ids) => x.search(db, ids, query, { userId }));
  return items.sort((a, b) => b.startsAt - a.startsAt).slice(0, LIMIT);
}

/** `/api/search`。入っているグループと、有効な拡張だけを対象に、題名と場所を探す */
export const searchRoutes = createRouter()
  .use("*", requireUser, requireAgreement)
  .get("/", zValidator("query", searchQuery, validationHook), async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const mine = await myGroupIds(db, me.id);
    return c.json({ items: await search(db, mine, c.req.valid("query").q, me.id) });
  });
