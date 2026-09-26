import { zValidator } from "@hono/zod-validator";
import { createRouter, HttpError, validationHook } from "@server/core/app";
import type { DB } from "@server/core/db/client";
import { count, desc, eq } from "drizzle-orm";
import { KAKEIBO_EXPENSE_CATEGORY_KEYS, KAKEIBO_INCOME_CATEGORY_KEYS } from "../shared/categories";
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

/** 種類に合うカテゴリかを確かめる。定期の記録は振替をまだ扱わない。F-325 */
function assertCategory(type: string, category: string | undefined): asserts category is string {
  if (type === "transfer") throw new HttpError(400, "振替の定期の記録はまだ作れません。");
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
    assertCategory(input.type, input.category);
    await requireKakeiboGroup(db, userId, input.groupId);

    const [{ n } = { n: 0 }] = await db
      .select({ n: count() })
      .from(kakeiboRecurrings)
      .where(eq(kakeiboRecurrings.createdBy, userId));
    if (n >= RECURRINGS_LIMIT) throw new HttpError(409, `定期の記録は ${RECURRINGS_LIMIT} 個までです。`);

    const accountId = input.accountId
      ? (await loadAccountForGroup(db, userId, input.accountId, input.groupId)).row.id
      : null;

    const id = crypto.randomUUID();
    await db.insert(kakeiboRecurrings).values({
      id,
      groupId: input.groupId,
      createdBy: userId,
      type: input.type,
      amount: input.amount,
      category: input.category,
      accountId,
      memo: input.memo || null,
      dayOfMonth: input.dayOfMonth,
      startMonth: input.startMonth,
      endMonth: input.endMonth ?? null,
    });
    const created = (await db.select().from(kakeiboRecurrings).where(eq(kakeiboRecurrings.id, id)).get())!;
    // 決めた日をもう過ぎていたら、その月の分をすぐ入れる。kota の決定(2026-09-26)。0072
    const today = dateKeyOfJst(Date.now());
    const occurrence = await tryInsertOccurrence(db, created, monthKeyOfDate(today), today);
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
    const category = input.category ?? current.category;
    assertCategory(type, category);

    let accountId = current.accountId;
    if (input.accountId !== undefined) {
      accountId = input.accountId
        ? (await loadAccountForGroup(db, userId, input.accountId, current.groupId)).row.id
        : null;
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
        amount: input.amount ?? current.amount,
        category,
        accountId,
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
