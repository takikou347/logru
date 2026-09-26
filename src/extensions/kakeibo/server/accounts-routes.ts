import { zValidator } from "@hono/zod-validator";
import { createRouter, HttpError, validationHook } from "@server/core/app";
import type { DB } from "@server/core/db/client";
import { and, count, desc, eq, gte, inArray, lt, max, or } from "drizzle-orm";
import { isMonthKey, monthRange } from "../shared/dates";
import { kakeiboAccountInput, kakeiboAccountPatchInput } from "../shared/schemas";
import { requireKakeiboGroup, usableGroupIds } from "./access";
import { computeBalances, toAccountDto, toExpenseDtos } from "./dto";
import {
  type KakeiboAccountRow,
  kakeiboAccounts,
  kakeiboExpenses,
  kakeiboRecurrings,
  kakeiboTemplates,
} from "./schema";

/** 1 つのグループに作れる口座の上限。個人か少人数の想定なので十分な余白を取る。0065 */
const ACCOUNTS_LIMIT = 30;

/** 月に 1 度に読む、口座が関わる記録の上限 */
const ACCOUNT_RECORDS_LIMIT = 500;

/**
 * 口座を読み、使えるグループのものか確かめる。無ければ 404、グループが使えなければ 404。F-309
 * @param db D1 を包んだ Drizzle
 * @param userId 読もうとする人
 * @param id 口座の ID
 */
async function loadUsableAccount(db: DB, userId: string, id: string): Promise<KakeiboAccountRow> {
  const row = await db.select().from(kakeiboAccounts).where(eq(kakeiboAccounts.id, id)).get();
  if (!row) throw new HttpError(404, "見つかりません。");
  await requireKakeiboGroup(db, userId, row.groupId);
  return row;
}

/** `/api/kakeibo/accounts`。kakeibo/server/routes.ts の `.route("/accounts", ...)` から差し込む。F-309、F-312、F-313、F-317 */
export const kakeiboAccountsRoutes = createRouter()
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
            .from(kakeiboAccounts)
            .where(inArray(kakeiboAccounts.groupId, groupIds))
            .orderBy(kakeiboAccounts.sortOrder, kakeiboAccounts.createdAt);
    const balances = await computeBalances(db, rows);
    return c.json({ accounts: rows.map((r) => toAccountDto(r, balances)) });
  })
  .post("/", zValidator("json", kakeiboAccountInput, validationHook), async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const input = c.req.valid("json");
    await requireKakeiboGroup(db, userId, input.groupId);
    const [{ n } = { n: 0 }] = await db
      .select({ n: count() })
      .from(kakeiboAccounts)
      .where(eq(kakeiboAccounts.groupId, input.groupId));
    if (n >= ACCOUNTS_LIMIT) throw new HttpError(409, `口座は ${ACCOUNTS_LIMIT} 個までです。`);
    const [{ m } = { m: null }] = await db
      .select({ m: max(kakeiboAccounts.sortOrder) })
      .from(kakeiboAccounts)
      .where(eq(kakeiboAccounts.groupId, input.groupId));
    const id = crypto.randomUUID();
    await db.insert(kakeiboAccounts).values({
      id,
      groupId: input.groupId,
      createdBy: userId,
      name: input.name,
      kind: input.kind,
      openingBalance: input.openingBalance,
      sortOrder: (m ?? -1) + 1,
    });
    const row = await db.select().from(kakeiboAccounts).where(eq(kakeiboAccounts.id, id)).get();
    return c.json(toAccountDto(row!, new Map([[id, input.openingBalance]])), 201);
  })
  .patch("/:id", zValidator("json", kakeiboAccountPatchInput, validationHook), async (c) => {
    const db = c.get("db");
    const current = await loadUsableAccount(db, c.get("user").id, c.req.param("id"));
    const input = c.req.valid("json");
    await db
      .update(kakeiboAccounts)
      .set({
        name: input.name ?? current.name,
        kind: input.kind ?? current.kind,
        openingBalance: input.openingBalance ?? current.openingBalance,
        sortOrder: input.sortOrder ?? current.sortOrder,
        archivedAt: input.archived === undefined ? current.archivedAt : input.archived ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(kakeiboAccounts.id, current.id));
    const row = await db.select().from(kakeiboAccounts).where(eq(kakeiboAccounts.id, current.id)).get();
    const balances = await computeBalances(db, [row!]);
    return c.json(toAccountDto(row!, balances));
  })
  .delete("/:id", async (c) => {
    const db = c.get("db");
    const current = await loadUsableAccount(db, c.get("user").id, c.req.param("id"));
    const [{ n } = { n: 0 }] = await db
      .select({ n: count() })
      .from(kakeiboExpenses)
      .where(or(eq(kakeiboExpenses.accountId, current.id), eq(kakeiboExpenses.toAccountId, current.id)));
    if (n > 0) throw new HttpError(409, "記録のある口座は消せません。「使わない」にしてください。");
    // 定期の記録・よく使う記録からも参照されていないか確かめる。#198
    const [{ n: nr } = { n: 0 }] = await db
      .select({ n: count() })
      .from(kakeiboRecurrings)
      .where(or(eq(kakeiboRecurrings.accountId, current.id), eq(kakeiboRecurrings.toAccountId, current.id)));
    if (nr > 0) throw new HttpError(409, "定期の記録が使っている口座は消せません。「使わない」にしてください。");
    const [{ n: nt } = { n: 0 }] = await db
      .select({ n: count() })
      .from(kakeiboTemplates)
      .where(or(eq(kakeiboTemplates.accountId, current.id), eq(kakeiboTemplates.toAccountId, current.id)));
    if (nt > 0) throw new HttpError(409, "よく使う記録が使っている口座は消せません。「使わない」にしてください。");
    await db.delete(kakeiboAccounts).where(eq(kakeiboAccounts.id, current.id));
    return c.body(null, 204);
  })
  .get("/:id/records", async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const account = await loadUsableAccount(db, userId, c.req.param("id"));
    const month = c.req.query("month") ?? "";
    if (!isMonthKey(month)) throw new HttpError(400, "月を `2026-09` の形で指定してください。");
    const { from, to } = monthRange(month);
    const rows = await db
      .select()
      .from(kakeiboExpenses)
      .where(
        and(
          or(eq(kakeiboExpenses.accountId, account.id), eq(kakeiboExpenses.toAccountId, account.id)),
          gte(kakeiboExpenses.date, from),
          lt(kakeiboExpenses.date, to),
        ),
      )
      .orderBy(desc(kakeiboExpenses.date), desc(kakeiboExpenses.id))
      .limit(ACCOUNT_RECORDS_LIMIT);
    const visibleGroupIds = new Set(await usableGroupIds(db, userId));
    const balances = await computeBalances(db, [account]);
    return c.json({
      account: toAccountDto(account, balances),
      records: await toExpenseDtos(db, rows, visibleGroupIds),
    });
  });
