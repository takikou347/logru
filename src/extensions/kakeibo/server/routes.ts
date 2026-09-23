import { zValidator } from "@hono/zod-validator";
import { createRouter, HttpError, validationHook } from "@server/core/app";
import { requireAgreement, requireUser } from "@server/core/auth/middleware";
import type { DB } from "@server/core/db/client";
import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { isMonthKey, monthRange } from "../shared/dates";
import { kakeiboInput, kakeiboPatchInput } from "../shared/schemas";
import { sumAmount, summarizeByCategory } from "../shared/totals";
import { requireKakeiboGroup, usableGroupIds } from "./access";
import { type KakeiboExpenseRow, kakeiboExpenses } from "./schema";

/** 月に 1 度に読む記録の上限。家計簿は個人か少人数の想定なので十分な余白を取る */
const RECORDS_LIMIT = 500;

/** 表の 1 行を、画面に返す形にする */
function toDto(row: KakeiboExpenseRow) {
  return {
    id: row.id,
    groupId: row.groupId,
    createdBy: row.createdBy,
    date: row.date,
    amount: row.amount,
    category: row.category,
    memo: row.memo,
  };
}

/**
 * 記録を読み、直せる人か確かめる。無ければ 404、グループが使えなければ 404、書いた人でなければ 403。F-307
 * @param db D1 を包んだ Drizzle
 * @param userId 直そうとする人
 * @param id 記録の ID
 */
async function loadOwned(db: DB, userId: string, id: string): Promise<KakeiboExpenseRow> {
  const row = await db.select().from(kakeiboExpenses).where(eq(kakeiboExpenses.id, id)).get();
  if (!row) throw new HttpError(404, "見つかりません。");
  await requireKakeiboGroup(db, userId, row.groupId);
  if (row.createdBy !== userId) throw new HttpError(403, "直せるのは、書いた人だけです。");
  return row;
}

/**
 * `/api/kakeibo`。支出を記録する、月の合計を読む、直す、消す。F-301、F-303、F-307
 *
 * 読めるのは、家計簿を使うと決めた人が、使うと決めたグループのメンバーだけ。
 * 直せて、消せるのは書いた人だけ。
 */
export const kakeiboRoutes = createRouter()
  .use("*", requireUser, requireAgreement)
  .get("/", async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const month = c.req.query("month") ?? "";
    if (!isMonthKey(month)) throw new HttpError(400, "月を `2026-09` の形で指定してください。");
    const groupParam = c.req.query("group");
    const groupIds = await usableGroupIds(db, userId, groupParam ? [groupParam] : undefined);
    if (groupParam && groupIds.length === 0) throw new HttpError(404, "見つかりません。");

    const { from, to } = monthRange(month);
    const rows =
      groupIds.length === 0
        ? []
        : await db
            .select()
            .from(kakeiboExpenses)
            .where(
              and(
                inArray(kakeiboExpenses.groupId, groupIds),
                gte(kakeiboExpenses.date, from),
                lt(kakeiboExpenses.date, to),
              ),
            )
            .orderBy(desc(kakeiboExpenses.date), desc(kakeiboExpenses.id))
            .limit(RECORDS_LIMIT);

    return c.json({ total: sumAmount(rows), byCategory: summarizeByCategory(rows), records: rows.map(toDto) });
  })
  .post("/", zValidator("json", kakeiboInput, validationHook), async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const input = c.req.valid("json");
    await requireKakeiboGroup(db, userId, input.groupId);
    const id = crypto.randomUUID();
    await db.insert(kakeiboExpenses).values({
      id,
      groupId: input.groupId,
      createdBy: userId,
      date: input.date,
      amount: input.amount,
      category: input.category,
      memo: input.memo || null,
    });
    const row = await db.select().from(kakeiboExpenses).where(eq(kakeiboExpenses.id, id)).get();
    return c.json(toDto(row!), 201);
  })
  .patch("/:id", zValidator("json", kakeiboPatchInput, validationHook), async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const current = await loadOwned(db, userId, c.req.param("id"));
    const input = c.req.valid("json");
    await db
      .update(kakeiboExpenses)
      .set({
        date: input.date ?? current.date,
        amount: input.amount ?? current.amount,
        category: input.category ?? current.category,
        memo: input.memo === undefined ? current.memo : input.memo || null,
        updatedAt: new Date(),
      })
      .where(eq(kakeiboExpenses.id, current.id));
    const row = await db.select().from(kakeiboExpenses).where(eq(kakeiboExpenses.id, current.id)).get();
    return c.json(toDto(row!));
  })
  .delete("/:id", async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const current = await loadOwned(db, userId, c.req.param("id"));
    await db.delete(kakeiboExpenses).where(eq(kakeiboExpenses.id, current.id));
    return c.body(null, 204);
  });
