import { zValidator } from "@hono/zod-validator";
import { createRouter, HttpError, validationHook } from "@server/core/app";
import type { DB } from "@server/core/db/client";
import { count, desc, eq } from "drizzle-orm";
import {
  KAKEIBO_EXPENSE_CATEGORY_KEYS,
  KAKEIBO_INCOME_CATEGORY_KEYS,
  type KakeiboCategory,
} from "../shared/categories";
import { dateKeyOfJst } from "../shared/dates";
import { monthKeyOfDate } from "../shared/recurring";
import { kakeiboRecurringInput, kakeiboRecurringPatchInput } from "../shared/schemas";
import { requireKakeiboGroup, usableGroups } from "./access";
import { type RecurringOccurrence, tryInsertOccurrence } from "./scheduled";
import { type KakeiboAccountRow, type KakeiboRecurringRow, kakeiboAccounts, kakeiboRecurrings } from "./schema";

/** 1 人が作れる定期の記録の上限。個人の想定なので十分な余白を取る。0065 */
const RECURRINGS_LIMIT = 50;

/** 画面に返す定期の記録の形。paused_at は真偽にする */
type KakeiboRecurringDto = {
  id: string;
  groupId: string;
  createdBy: string | null;
  type: KakeiboRecurringRow["type"];
  amount: number;
  category: KakeiboRecurringRow["category"];
  accountId: string | null;
  toAccountId: string | null;
  memo: string | null;
  dayOfMonth: number;
  startMonth: string;
  endMonth: string | null;
  lastMonth: string | null;
  paused: boolean;
};

/**
 * 作った直後の応答だけに乗る、その場で入れた記録。決めた日をもう過ぎていたときだけ入る。
 * 画面は、これがあれば「9月1日の分を記録しました」と日付を出し、元に戻す道を付ける。#198
 */
type KakeiboRecurringCreateDto = KakeiboRecurringDto & { occurrence: RecurringOccurrence | null };

function toDto(row: KakeiboRecurringRow): KakeiboRecurringDto {
  return {
    id: row.id,
    groupId: row.groupId,
    createdBy: row.createdBy,
    type: row.type,
    amount: row.amount,
    category: row.category,
    accountId: row.accountId,
    toAccountId: row.toAccountId,
    memo: row.memo,
    dayOfMonth: row.dayOfMonth,
    startMonth: row.startMonth,
    endMonth: row.endMonth,
    lastMonth: row.lastMonth,
    paused: row.pausedAt !== null,
  };
}

/**
 * 口座を読み、この定期の記録のグループで選べるか確かめる。0069、F-319
 * 記録と同じグループの口座(共有口座を含む)か、自分の口座(立て替えで割る側)だけ選べる
 */
async function loadAccountForGroup(
  db: DB,
  userId: string,
  id: string,
  groupId: string,
): Promise<{ row: KakeiboAccountRow; isPersonal: boolean }> {
  const row = await db.select().from(kakeiboAccounts).where(eq(kakeiboAccounts.id, id)).get();
  if (!row) throw new HttpError(404, "見つかりません。");
  const usable = await usableGroups(db, userId, [row.groupId]);
  if (usable.length === 0) throw new HttpError(404, "見つかりません。");
  const isPersonal = usable[0]!.isPersonal;
  if (row.groupId !== groupId && !isPersonal) throw new HttpError(400, "その口座は選べません。");
  return { row, isPersonal };
}

/** 口座を読み、書こうとしている人が使えるグループの口座かだけ確かめる。振替の口座を選ぶときに使う。0069、0087 */
async function loadUsableAccount(
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

/**
 * 振替の定期の記録の、出す元・入れる先の口座を確かめ、置くグループを決める。決め方は記録の振替
 * (routes.ts の resolveWrite)と同じ。0069、0087、F-328
 * @param current 直すときの、いまの行。片方だけ送ったときに、もう片方はここから引く
 */
async function resolveRecurringTransfer(
  db: DB,
  userId: string,
  input: { accountId?: string | null; toAccountId?: string | null },
  current?: KakeiboRecurringRow,
): Promise<{ accountId: string; toAccountId: string; groupId: string }> {
  const accountId = input.accountId !== undefined ? input.accountId : (current?.accountId ?? null);
  const toAccountId = input.toAccountId !== undefined ? input.toAccountId : (current?.toAccountId ?? null);
  if (!accountId || !toAccountId) throw new HttpError(400, "出す元と入れる先の口座を選んでください。");
  if (accountId === toAccountId) throw new HttpError(400, "出す元と入れる先は、別の口座にしてください。");
  const from = await loadUsableAccount(db, userId, accountId);
  const to = await loadUsableAccount(db, userId, toAccountId);
  const fromUnchanged = current?.accountId === from.row.id;
  const toUnchanged = current?.toAccountId === to.row.id;
  if (from.row.archivedAt && !fromUnchanged)
    throw new HttpError(400, "この口座は使えません。「使わない」にした口座です。");
  if (to.row.archivedAt && !toUnchanged) throw new HttpError(400, "この口座は使えません。「使わない」にした口座です。");
  // 振替を置くグループは、関わる口座で決める。画面からは送らせない。0069
  const groupId = to.isPersonal ? from.row.groupId : to.row.groupId;
  return { accountId: from.row.id, toAccountId: to.row.id, groupId };
}

/** 種類に合うカテゴリかを確かめる。振替は呼び出し側でカテゴリを `transfer` に決める。F-325、0087 */
function assertCategory(type: string, category: string | undefined): asserts category is string {
  const allowed = type === "expense" ? KAKEIBO_EXPENSE_CATEGORY_KEYS : KAKEIBO_INCOME_CATEGORY_KEYS;
  if (!category || !(allowed as readonly string[]).includes(category)) {
    throw new HttpError(400, "カテゴリを選んでください。");
  }
}

/** 定期の記録を読み、作った人か確かめる。無ければ 404、作った人でなければ 403。F-325 */
async function loadOwned(db: DB, userId: string, id: string): Promise<KakeiboRecurringRow> {
  const row = await db.select().from(kakeiboRecurrings).where(eq(kakeiboRecurrings.id, id)).get();
  if (!row) throw new HttpError(404, "見つかりません。");
  if (row.createdBy !== userId) throw new HttpError(403, "直せるのは、作った人だけです。");
  return row;
}

/** `/api/kakeibo/recurrings`。定期の記録を作る、直す、止める、消す。読むのは本人が作ったものだけ。F-325 */
export const kakeiboRecurringsRoutes = createRouter()
  .get("/", async (c) => {
    const db = c.get("db");
    const rows = await db
      .select()
      .from(kakeiboRecurrings)
      .where(eq(kakeiboRecurrings.createdBy, c.get("user").id))
      .orderBy(desc(kakeiboRecurrings.createdAt));
    return c.json({ recurrings: rows.map(toDto) });
  })
  .post("/", zValidator("json", kakeiboRecurringInput, validationHook), async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const input = c.req.valid("json");

    let groupId: string;
    let accountId: string | null;
    let toAccountId: string | null = null;
    let category: KakeiboCategory;
    if (input.type === "transfer") {
      const resolved = await resolveRecurringTransfer(db, userId, input);
      groupId = resolved.groupId;
      accountId = resolved.accountId;
      toAccountId = resolved.toAccountId;
      category = "transfer";
    } else {
      if (!input.groupId) throw new HttpError(400, "記録するグループを選んでください。");
      assertCategory(input.type, input.category);
      category = input.category;
      await requireKakeiboGroup(db, userId, input.groupId);
      groupId = input.groupId;
      accountId = input.accountId ? (await loadAccountForGroup(db, userId, input.accountId, groupId)).row.id : null;
    }

    const [{ n } = { n: 0 }] = await db
      .select({ n: count() })
      .from(kakeiboRecurrings)
      .where(eq(kakeiboRecurrings.createdBy, userId));
    if (n >= RECURRINGS_LIMIT) throw new HttpError(409, `定期の記録は ${RECURRINGS_LIMIT} 個までです。`);

    const id = crypto.randomUUID();
    await db.insert(kakeiboRecurrings).values({
      id,
      groupId,
      createdBy: userId,
      type: input.type,
      amount: input.amount,
      category,
      accountId,
      toAccountId,
      memo: input.memo || null,
      dayOfMonth: input.dayOfMonth,
      startMonth: input.startMonth,
      endMonth: input.endMonth ?? null,
    });
    const created = (await db.select().from(kakeiboRecurrings).where(eq(kakeiboRecurrings.id, id)).get())!;
    // 決めた日をもう過ぎていたら、その月の分をすぐ入れる。kota の決定(2026-09-26)。0072
    const today = dateKeyOfJst(Date.now());
    const occurrence = await tryInsertOccurrence(db, c.env, created, monthKeyOfDate(today), today);
    const row = (await db.select().from(kakeiboRecurrings).where(eq(kakeiboRecurrings.id, id)).get())!;
    // 画面は occurrence があれば、その日付を知らせに出し、元に戻す(その 1 件を消す)道を付ける。#198
    const dto: KakeiboRecurringCreateDto = { ...toDto(row), occurrence };
    return c.json(dto, 201);
  })
  .patch("/:id", zValidator("json", kakeiboRecurringPatchInput, validationHook), async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const current = await loadOwned(db, userId, c.req.param("id"));
    const input = c.req.valid("json");
    const type = input.type ?? current.type;

    let groupId = current.groupId;
    let accountId = current.accountId;
    let toAccountId = current.toAccountId;
    let category: KakeiboCategory = input.category ?? current.category;
    if (type === "transfer") {
      const resolved = await resolveRecurringTransfer(db, userId, input, current);
      groupId = resolved.groupId;
      accountId = resolved.accountId;
      toAccountId = resolved.toAccountId;
      category = "transfer";
    } else {
      assertCategory(type, category);
      toAccountId = null;
      if (input.accountId !== undefined) {
        accountId = input.accountId
          ? (await loadAccountForGroup(db, userId, input.accountId, current.groupId)).row.id
          : null;
      }
    }

    const startMonth = input.startMonth ?? current.startMonth;
    const endMonth = input.endMonth === undefined ? current.endMonth : input.endMonth;
    // 送った項目といまの値を合わせた形でも、終わりの月が始まりの月より前でないか確かめる。budgets-routes.ts と同じ形。#198
    if (endMonth && endMonth < startMonth)
      throw new HttpError(400, "終わりの月は、始まりの月と同じか後にしてください。");

    await db
      .update(kakeiboRecurrings)
      .set({
        type,
        groupId,
        amount: input.amount ?? current.amount,
        category,
        accountId,
        toAccountId,
        memo: input.memo === undefined ? current.memo : input.memo || null,
        dayOfMonth: input.dayOfMonth ?? current.dayOfMonth,
        startMonth,
        endMonth,
        pausedAt: input.paused === undefined ? current.pausedAt : input.paused ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(kakeiboRecurrings.id, current.id));
    const row = (await db.select().from(kakeiboRecurrings).where(eq(kakeiboRecurrings.id, current.id)).get())!;
    return c.json(toDto(row));
  })
  .delete("/:id", async (c) => {
    const db = c.get("db");
    const current = await loadOwned(db, c.get("user").id, c.req.param("id"));
    await db.delete(kakeiboRecurrings).where(eq(kakeiboRecurrings.id, current.id));
    return c.body(null, 204);
  });
