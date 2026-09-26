import { zValidator } from "@hono/zod-validator";
import { createRouter, HttpError, validationHook } from "@server/core/app";
import { requireAgreement, requireUser } from "@server/core/auth/middleware";
import type { DB } from "@server/core/db/client";
import { and, count, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import { KAKEIBO_EXPENSE_CATEGORY_KEYS, KAKEIBO_INCOME_CATEGORY_KEYS } from "../shared/categories";
import { DAY_MS, dateKeyOfJst, isMonthKey, monthRange } from "../shared/dates";
import { kakeiboInput } from "../shared/schemas";
import { sumByType, summarizeExpenseByCategory } from "../shared/totals";
import { requireKakeiboGroup, usableGroupIds, usableGroups } from "./access";
import { kakeiboAccountsRoutes } from "./accounts-routes";
import { kakeiboBudgetsRoutes } from "./budgets-routes";
import { toExpenseDtos } from "./dto";
import { kakeiboRecurringsRoutes } from "./recurring-routes";
import { type KakeiboAccountRow, type KakeiboExpenseRow, kakeiboAccounts, kakeiboExpenses } from "./schema";
import { kakeiboSettlementRoutes, kakeiboSettlementsRoutes } from "./settlement-routes";
import { myShareDebts, sharedBurdenThisMonth } from "./settlement-summary";
import { resolveSplitPlan, writeSplits } from "./splits";
import { kakeiboTemplatesRoutes } from "./templates-routes";

/** 月に 1 度に読む記録の上限。家計簿は個人か少人数の想定なので十分な余白を取る */
const RECORDS_LIMIT = 500;
/** 直近の何日分の記録から、よく使うカテゴリを数えるか。F-314 */
const USAGE_WINDOW_DAYS = 90;

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
 * 口座を読み、書こうとしている人がその口座のグループを使えるか確かめる。0069
 * @returns 口座の行と、その口座のグループが自分だけのグループかどうか
 */
async function loadWritableAccount(
  db: DB,
  userId: string,
  id: string,
): Promise<{ row: KakeiboAccountRow; isPersonal: boolean }> {
  const row = await db.select().from(kakeiboAccounts).where(eq(kakeiboAccounts.id, id)).get();
  if (!row) throw new HttpError(404, "見つかりません。");
  const usable = await usableGroups(db, userId, [row.groupId]);
  if (usable.length === 0) throw new HttpError(404, "見つかりません。");
  return { row, isPersonal: usable[0]!.isPersonal };
}

/** 保存に使う、確かめ済みの値 */
type ResolvedWrite = Pick<
  KakeiboExpenseRow,
  "groupId" | "type" | "date" | "amount" | "category" | "accountId" | "toAccountId" | "paidBy" | "splitMode"
>;

/**
 * 種類ごとの入力の決まりを確かめ、保存する値を組み立てる。振替のグループはここで決める。0069
 *
 * 支出は、共有のグループで共有口座以外(自分の口座、口座なし)で払ったときだけ、立て替えとして割る。
 * 割った結果(shares)は呼び出し側が writeSplits で書き込む。0072、F-318
 *
 * @param current 直すときの、いまの行。新しく作るときは無い
 */
async function resolveWrite(
  db: DB,
  userId: string,
  input: ReturnType<typeof kakeiboInput.parse>,
  current?: KakeiboExpenseRow,
): Promise<{ write: ResolvedWrite; shares: Awaited<ReturnType<typeof resolveSplitPlan>>["shares"] }> {
  if (input.type === "transfer") {
    if (!input.accountId || !input.toAccountId) throw new HttpError(400, "出す元と入れる先の口座を選んでください。");
    if (input.accountId === input.toAccountId) throw new HttpError(400, "出す元と入れる先は、別の口座にしてください。");
    const from = await loadWritableAccount(db, userId, input.accountId);
    const to = await loadWritableAccount(db, userId, input.toAccountId);
    const fromUnchanged = current?.accountId === from.row.id;
    const toUnchanged = current?.toAccountId === to.row.id;
    if (from.row.archivedAt && !fromUnchanged)
      throw new HttpError(400, "この口座は使えません。「使わない」にした口座です。");
    if (to.row.archivedAt && !toUnchanged)
      throw new HttpError(400, "この口座は使えません。「使わない」にした口座です。");
    // 振替を置くグループは、関わる口座で決める。画面からは送らせない。0069
    const groupId = to.isPersonal ? from.row.groupId : to.row.groupId;
    return {
      write: {
        groupId,
        type: "transfer",
        date: input.date,
        amount: input.amount,
        category: "transfer",
        accountId: from.row.id,
        toAccountId: to.row.id,
        paidBy: null,
        splitMode: null,
      },
      shares: [],
    };
  }

  if (!input.groupId) throw new HttpError(400, "記録するグループを選んでください。");
  const groupRow = (await usableGroups(db, userId, [input.groupId]))[0];
  if (!groupRow) throw new HttpError(404, "見つかりません。");
  const allowed = input.type === "expense" ? KAKEIBO_EXPENSE_CATEGORY_KEYS : KAKEIBO_INCOME_CATEGORY_KEYS;
  if (!input.category || !(allowed as readonly string[]).includes(input.category))
    throw new HttpError(400, "カテゴリを選んでください。");

  let accountId: string | null = null;
  let account: { row: KakeiboAccountRow; isPersonal: boolean } | null = null;
  if (input.accountId !== undefined) {
    if (input.accountId !== null) {
      account = await loadWritableAccount(db, userId, input.accountId);
      // 記録と同じグループの口座(共有口座を含む)か、支出でグループが共有のときだけ、自分の口座も選べる。F-319
      const sameGroup = account.row.groupId === input.groupId;
      const ownPersonalForSplit = input.type === "expense" && !groupRow.isPersonal && account.isPersonal;
      if (!sameGroup && !ownPersonalForSplit) throw new HttpError(400, "その口座は、このグループでは選べません。");
      const unchanged = current?.accountId === account.row.id;
      if (account.row.archivedAt && !unchanged)
        throw new HttpError(400, "この口座は使えません。「使わない」にした口座です。");
      accountId = account.row.id;
    }
  } else {
    accountId = current?.accountId ?? null;
    // PATCH で口座を送らなかったとき。いまの口座のまま、割るかどうかの判定にも使う
    if (accountId) account = await loadWritableAccount(db, userId, accountId);
  }

  const plan = await resolveSplitPlan(
    db,
    userId,
    {
      type: input.type,
      groupId: input.groupId,
      amount: input.amount,
      paidBy: input.paidBy,
      splitMode: input.splitMode,
      splits: input.splits,
    },
    groupRow.isPersonal,
    account ? { groupId: account.row.groupId, isPersonal: account.isPersonal } : null,
  );

  return {
    write: {
      groupId: input.groupId,
      type: input.type,
      date: input.date,
      amount: input.amount,
      category: input.category,
      accountId,
      toAccountId: null,
      paidBy: plan.paidBy,
      splitMode: plan.splitMode,
    },
    shares: plan.shares,
  };
}

/** `/api/kakeibo`。記録する、月の合計を読む、直す、消す。口座は `/accounts` に分ける。F-301〜F-317 */
export const kakeiboRoutes = createRouter()
  .use("*", requireUser, requireAgreement)
  // `/:id` より先に載せる。後に置くと `/accounts` が記録の ID として読まれる
  .route("/accounts", kakeiboAccountsRoutes)
  .route("/settlement", kakeiboSettlementRoutes)
  .route("/settlements", kakeiboSettlementsRoutes)
  .route("/budgets", kakeiboBudgetsRoutes)
  .route("/recurrings", kakeiboRecurringsRoutes)
  .route("/templates", kakeiboTemplatesRoutes)
  .get("/usage", async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const cutoff = dateKeyOfJst(Date.now() - USAGE_WINDOW_DAYS * DAY_MS);
    const rows = await db
      .select({ type: kakeiboExpenses.type, category: kakeiboExpenses.category })
      .from(kakeiboExpenses)
      .where(
        and(
          eq(kakeiboExpenses.createdBy, userId),
          gte(kakeiboExpenses.date, cutoff),
          inArray(kakeiboExpenses.type, ["expense", "income"]),
        ),
      );
    const countBy = (type: "expense" | "income") => {
      const counts = new Map<string, number>();
      for (const r of rows) if (r.type === type) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
      return [...counts.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
    };
    return c.json({ expense: countBy("expense"), income: countBy("income") });
  })
  .get("/", async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const month = c.req.query("month") ?? "";
    if (!isMonthKey(month)) throw new HttpError(400, "月を `2026-09` の形で指定してください。");
    const groupParam = c.req.query("group");
    // 使えるグループはここで 1 回だけ読み、絞り込み・自分だけのグループ探し・見える範囲の判定に使い回す。#199
    const allUsable = await usableGroups(db, userId);
    const groupIds = groupParam
      ? allUsable.filter((g) => g.id === groupParam).map((g) => g.id)
      : allUsable.map((g) => g.id);
    if (groupParam && groupIds.length === 0) throw new HttpError(404, "見つかりません。");

    const { from, to } = monthRange(month);
    const monthWhere =
      groupIds.length === 0
        ? null
        : and(
            inArray(kakeiboExpenses.groupId, groupIds),
            gte(kakeiboExpenses.date, from),
            lt(kakeiboExpenses.date, to),
          );
    const rows =
      monthWhere === null
        ? []
        : await db
            .select()
            .from(kakeiboExpenses)
            .where(monthWhere)
            .orderBy(desc(kakeiboExpenses.date), desc(kakeiboExpenses.id))
            .limit(RECORDS_LIMIT);

    // 合計とカテゴリ別の合計は、一覧を RECORDS_LIMIT で切る前の全件から、SQL の GROUP BY で出す。
    // 切るのは一覧(records)だけ。0069、F-303、#199
    const totalsRows =
      monthWhere === null
        ? []
        : await db
            .select({
              type: kakeiboExpenses.type,
              category: kakeiboExpenses.category,
              amount: sql<number>`coalesce(sum(${kakeiboExpenses.amount}), 0)`,
              n: count(),
            })
            .from(kakeiboExpenses)
            .where(monthWhere)
            .groupBy(kakeiboExpenses.type, kakeiboExpenses.category);
    const recordCount = totalsRows.reduce((n, t) => n + t.n, 0);
    // 一覧を切ったときは、画面に「新しい 500 件を出しています」のように出す。#199
    const recordsTruncated = recordCount > RECORDS_LIMIT;

    // 自分だけで絞ったときだけ、共有口座とのやり取りを別の行で出す。0069、F-303
    const personalGroupId = allUsable.find((g) => g.isPersonal)?.id ?? null;
    let toShared: number | null = null;
    let fromShared: number | null = null;
    if (personalGroupId && groupParam === personalGroupId) {
      const personalAccountIds = (
        await db
          .select({ id: kakeiboAccounts.id })
          .from(kakeiboAccounts)
          .where(eq(kakeiboAccounts.groupId, personalGroupId))
      ).map((r) => r.id);
      if (personalAccountIds.length > 0) {
        // 振替はどのグループにも属さず読むので、自分の口座の ID(account_id か to_account_id)で絞る。#199
        const transfers = await db
          .select({
            amount: kakeiboExpenses.amount,
            accountId: kakeiboExpenses.accountId,
            toAccountId: kakeiboExpenses.toAccountId,
          })
          .from(kakeiboExpenses)
          .where(
            and(
              eq(kakeiboExpenses.type, "transfer"),
              gte(kakeiboExpenses.date, from),
              lt(kakeiboExpenses.date, to),
              or(
                inArray(kakeiboExpenses.accountId, personalAccountIds),
                inArray(kakeiboExpenses.toAccountId, personalAccountIds),
              ),
            ),
          );
        // 自分の口座から、自分の口座ではない先(共有口座)へ出したぶん
        toShared = transfers
          .filter(
            (t) =>
              t.accountId &&
              personalAccountIds.includes(t.accountId) &&
              !(t.toAccountId && personalAccountIds.includes(t.toAccountId)),
          )
          .reduce((n, t) => n + t.amount, 0);
        // 自分の口座ではない元(共有口座)から、自分の口座へ入ったぶん
        fromShared = transfers
          .filter(
            (t) =>
              t.toAccountId &&
              personalAccountIds.includes(t.toAccountId) &&
              !(t.accountId && personalAccountIds.includes(t.accountId)),
          )
          .reduce((n, t) => n + t.amount, 0);
      } else {
        toShared = 0;
        fromShared = 0;
      }
    }

    // 自分だけで絞ったときだけ、その月にグループで負担した額と、いま立て替え中の額を別に出す。0072、F-322
    let sharedBurden: number | null = null;
    let debts: { groupId: string; receivable: number; payable: number }[] | null = null;
    if (personalGroupId && groupParam === personalGroupId) {
      sharedBurden = await sharedBurdenThisMonth(db, userId, from, to);
      debts = await myShareDebts(
        db,
        userId,
        allUsable.map((g) => g.id),
      );
    }

    const visibleGroupIds = new Set(allUsable.map((g) => g.id));
    return c.json({
      totalExpense: sumByType(totalsRows, "expense"),
      totalIncome: sumByType(totalsRows, "income"),
      byCategory: summarizeExpenseByCategory(totalsRows),
      toShared,
      fromShared,
      sharedBurden,
      debts,
      recordsTruncated,
      records: await toExpenseDtos(db, rows, visibleGroupIds),
    });
  })
  .post("/", zValidator("json", kakeiboInput, validationHook), async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const input = c.req.valid("json");
    const { write, shares } = await resolveWrite(db, userId, input);
    const id = crypto.randomUUID();
    await db.insert(kakeiboExpenses).values({ id, createdBy: userId, memo: input.memo || null, ...write });
    await writeSplits(db, id, shares);
    const row = await db.select().from(kakeiboExpenses).where(eq(kakeiboExpenses.id, id)).get();
    const visibleGroupIds = new Set(await usableGroupIds(db, userId));
    return c.json((await toExpenseDtos(db, [row!], visibleGroupIds))[0], 201);
  })
  .patch("/:id", zValidator("json", kakeiboInput, validationHook), async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const current = await loadOwned(db, userId, c.req.param("id"));
    const input = c.req.valid("json");
    const { write, shares } = await resolveWrite(db, userId, input, current);
    await db
      .update(kakeiboExpenses)
      .set({ memo: input.memo === undefined ? current.memo : input.memo || null, updatedAt: new Date(), ...write })
      .where(eq(kakeiboExpenses.id, current.id));
    await writeSplits(db, current.id, shares);
    const row = await db.select().from(kakeiboExpenses).where(eq(kakeiboExpenses.id, current.id)).get();
    const visibleGroupIds = new Set(await usableGroupIds(db, userId));
    return c.json((await toExpenseDtos(db, [row!], visibleGroupIds))[0]);
  })
  .delete("/:id", async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const current = await loadOwned(db, userId, c.req.param("id"));
    await db.delete(kakeiboExpenses).where(eq(kakeiboExpenses.id, current.id));
    return c.body(null, 204);
  });
