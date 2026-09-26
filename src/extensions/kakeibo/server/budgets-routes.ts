import { zValidator } from "@hono/zod-validator";
import { createRouter, HttpError, validationHook } from "@server/core/app";
import type { DB } from "@server/core/db/client";
import { and, count, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { kakeiboBudgetInput, kakeiboBudgetPatchInput } from "../shared/schemas";
import { requireKakeiboGroup, usableGroupIds } from "./access";
import { type KakeiboBudgetRow, kakeiboBudgets, kakeiboExpenses } from "./schema";

/** 1 つのグループに作れる予算の上限。個人か少人数の想定なので十分な余白を取る。0065 */
const BUDGETS_LIMIT = 50;

/** 画面に返す予算の形。使った額を添える */
type KakeiboBudgetDto = {
  id: string;
  groupId: string;
  createdBy: string | null;
  name: string;
  startDate: string;
  endDate: string;
  amount: number;
  used: number;
};

/**
 * その予算の期間に実際に使った額。そのグループの支出のうち、期間の中(終わりの日を含む)の日付のもの。
 * 振替と収入は入れない。F-324
 */
async function usedAmount(db: DB, groupId: string, startDate: string, endDate: string): Promise<number> {
  const rows = await db
    .select({ amount: kakeiboExpenses.amount })
    .from(kakeiboExpenses)
    .where(
      and(
        eq(kakeiboExpenses.groupId, groupId),
        eq(kakeiboExpenses.type, "expense"),
        gte(kakeiboExpenses.date, startDate),
        lte(kakeiboExpenses.date, endDate),
      ),
    );
  return rows.reduce((n, r) => n + r.amount, 0);
}

/**
 * 複数の予算の使った額を、1 本の GROUP BY で読む。予算ごとに期間が違うので、まず対象のグループの
 * 日ごとの合計をまとめて読み、それぞれの予算の期間に入る日を足し合わせる。#199
 * @returns 予算の ID から使った額への対応
 */
async function usedAmounts(db: DB, rows: KakeiboBudgetRow[]): Promise<Map<string, number>> {
  const used = new Map(rows.map((r) => [r.id, 0]));
  if (rows.length === 0) return used;
  const groupIds = [...new Set(rows.map((r) => r.groupId))];
  const minStart = rows.reduce((min, r) => (r.startDate < min ? r.startDate : min), rows[0]!.startDate);
  const maxEnd = rows.reduce((max, r) => (r.endDate > max ? r.endDate : max), rows[0]!.endDate);
  const daily = await db
    .select({
      groupId: kakeiboExpenses.groupId,
      date: kakeiboExpenses.date,
      amount: sql<number>`coalesce(sum(${kakeiboExpenses.amount}), 0)`,
    })
    .from(kakeiboExpenses)
    .where(
      and(
        inArray(kakeiboExpenses.groupId, groupIds),
        eq(kakeiboExpenses.type, "expense"),
        gte(kakeiboExpenses.date, minStart),
        lte(kakeiboExpenses.date, maxEnd),
      ),
    )
    .groupBy(kakeiboExpenses.groupId, kakeiboExpenses.date);
  for (const row of rows) {
    let sum = 0;
    for (const d of daily)
      if (d.groupId === row.groupId && d.date >= row.startDate && d.date <= row.endDate) sum += d.amount;
    used.set(row.id, sum);
  }
  return used;
}

function toBudgetDto(row: KakeiboBudgetRow, used: number): KakeiboBudgetDto {
  return {
    id: row.id,
    groupId: row.groupId,
    createdBy: row.createdBy,
    name: row.name,
    startDate: row.startDate,
    endDate: row.endDate,
    amount: row.amount,
    used,
  };
}

/**
 * 予算を読み、使えるグループのものか確かめる。無ければ 404、グループが使えなければ 404。F-323
 * 直す・消すは、口座と同じく、そのグループのメンバーなら誰でもできる
 */
async function loadUsableBudget(db: DB, userId: string, id: string): Promise<KakeiboBudgetRow> {
  const row = await db.select().from(kakeiboBudgets).where(eq(kakeiboBudgets.id, id)).get();
  if (!row) throw new HttpError(404, "見つかりません。");
  await requireKakeiboGroup(db, userId, row.groupId);
  return row;
}

/** `/api/kakeibo/budgets`。期間の予算を作る、直す、消す、使った額とともに見る。F-323、F-324 */
export const kakeiboBudgetsRoutes = createRouter()
  .get("/", async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const groupParam = c.req.query("group");
    const groupIds = await usableGroupIds(db, userId, groupParam ? [groupParam] : undefined);
    if (groupParam && groupIds.length === 0) throw new HttpError(404, "見つかりません。");

    const rows =
      groupIds.length === 0
        ? []
        : await db
            .select()
            .from(kakeiboBudgets)
            .where(inArray(kakeiboBudgets.groupId, groupIds))
            .orderBy(kakeiboBudgets.startDate);
    const used = await usedAmounts(db, rows);
    const budgets = rows.map((row) => toBudgetDto(row, used.get(row.id) ?? 0));
    return c.json({ budgets });
  })
  .post("/", zValidator("json", kakeiboBudgetInput, validationHook), async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const input = c.req.valid("json");
    await requireKakeiboGroup(db, userId, input.groupId);
    const [{ n } = { n: 0 }] = await db
      .select({ n: count() })
      .from(kakeiboBudgets)
      .where(eq(kakeiboBudgets.groupId, input.groupId));
    if (n >= BUDGETS_LIMIT) throw new HttpError(409, `予算は ${BUDGETS_LIMIT} 個までです。`);

    const id = crypto.randomUUID();
    await db.insert(kakeiboBudgets).values({
      id,
      groupId: input.groupId,
      createdBy: userId,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      amount: input.amount,
    });
    const row = await db.select().from(kakeiboBudgets).where(eq(kakeiboBudgets.id, id)).get();
    return c.json(toBudgetDto(row!, await usedAmount(db, row!.groupId, row!.startDate, row!.endDate)), 201);
  })
  .patch("/:id", zValidator("json", kakeiboBudgetPatchInput, validationHook), async (c) => {
    const db = c.get("db");
    const current = await loadUsableBudget(db, c.get("user").id, c.req.param("id"));
    const input = c.req.valid("json");
    const startDate = input.startDate ?? current.startDate;
    const endDate = input.endDate ?? current.endDate;
    if (endDate < startDate) throw new HttpError(400, "終わりの日は、始まりの日と同じか後にしてください。");

    await db
      .update(kakeiboBudgets)
      .set({
        name: input.name ?? current.name,
        startDate,
        endDate,
        amount: input.amount ?? current.amount,
        updatedAt: new Date(),
      })
      .where(eq(kakeiboBudgets.id, current.id));
    const row = await db.select().from(kakeiboBudgets).where(eq(kakeiboBudgets.id, current.id)).get();
    return c.json(toBudgetDto(row!, await usedAmount(db, row!.groupId, row!.startDate, row!.endDate)));
  })
  .delete("/:id", async (c) => {
    const db = c.get("db");
    const current = await loadUsableBudget(db, c.get("user").id, c.req.param("id"));
    await db.delete(kakeiboBudgets).where(eq(kakeiboBudgets.id, current.id));
    return c.body(null, 204);
  });
