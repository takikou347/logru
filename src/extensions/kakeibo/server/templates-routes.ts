import { zValidator } from "@hono/zod-validator";
import { createRouter, HttpError, validationHook } from "@server/core/app";
import type { DB } from "@server/core/db/client";
import { count, desc, eq } from "drizzle-orm";
import { KAKEIBO_EXPENSE_CATEGORY_KEYS, KAKEIBO_INCOME_CATEGORY_KEYS } from "../shared/categories";
import { kakeiboTemplateInput, kakeiboTemplatePatchInput } from "../shared/schemas";
import { usableGroups } from "./access";
import { type KakeiboAccountRow, type KakeiboTemplateRow, kakeiboAccounts, kakeiboTemplates } from "./schema";

/** 1 人が作れるよく使う記録の上限。0065 */
const TEMPLATES_LIMIT = 50;

/** 画面に返すよく使う記録の形 */
type KakeiboTemplateDto = {
  id: string;
  name: string;
  type: KakeiboTemplateRow["type"];
  groupId: string | null;
  category: KakeiboTemplateRow["category"];
  accountId: string | null;
  toAccountId: string | null;
  memo: string | null;
  amount: number | null;
};

function toDto(row: KakeiboTemplateRow): KakeiboTemplateDto {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    groupId: row.groupId,
    category: row.category,
    accountId: row.accountId,
    toAccountId: row.toAccountId,
    memo: row.memo,
    amount: row.amount,
  };
}

/** カテゴリが種類に合うか確かめる。振替はまだ扱わない */
function assertCategory(type: string, category: string | undefined | null): void {
  if (type === "transfer") throw new HttpError(400, "振替のよく使う記録はまだ作れません。");
  const allowed = type === "expense" ? KAKEIBO_EXPENSE_CATEGORY_KEYS : KAKEIBO_INCOME_CATEGORY_KEYS;
  if (category && !(allowed as readonly string[]).includes(category)) {
    throw new HttpError(400, "カテゴリを選んでください。");
  }
}

/** グループが指定されていれば、使えるグループのものか確かめる。F-326 */
async function assertUsableGroup(db: DB, userId: string, groupId: string | null | undefined): Promise<void> {
  if (!groupId) return;
  const usable = await usableGroups(db, userId, [groupId]);
  if (usable.length === 0) throw new HttpError(404, "見つかりません。");
}

/** 口座が指定されていれば、使えるグループの口座か確かめる。F-326 */
async function assertUsableAccount(
  db: DB,
  userId: string,
  accountId: string | null | undefined,
): Promise<KakeiboAccountRow | null> {
  if (!accountId) return null;
  const row = await db.select().from(kakeiboAccounts).where(eq(kakeiboAccounts.id, accountId)).get();
  if (!row) throw new HttpError(404, "見つかりません。");
  const usable = await usableGroups(db, userId, [row.groupId]);
  if (usable.length === 0) throw new HttpError(404, "見つかりません。");
  return row;
}

async function loadOwned(db: DB, userId: string, id: string): Promise<KakeiboTemplateRow> {
  const row = await db.select().from(kakeiboTemplates).where(eq(kakeiboTemplates.id, id)).get();
  if (!row || row.userId !== userId) throw new HttpError(404, "見つかりません。");
  return row;
}

/** `/api/kakeibo/templates`。よく使う記録。本人のものだけ。F-326 */
export const kakeiboTemplatesRoutes = createRouter()
  .get("/", async (c) => {
    const db = c.get("db");
    const rows = await db
      .select()
      .from(kakeiboTemplates)
      .where(eq(kakeiboTemplates.userId, c.get("user").id))
      .orderBy(desc(kakeiboTemplates.createdAt));
    return c.json({ templates: rows.map(toDto) });
  })
  .post("/", zValidator("json", kakeiboTemplateInput, validationHook), async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const input = c.req.valid("json");
    assertCategory(input.type, input.category);
    await assertUsableGroup(db, userId, input.groupId);
    const account = await assertUsableAccount(db, userId, input.accountId);

    const [{ n } = { n: 0 }] = await db
      .select({ n: count() })
      .from(kakeiboTemplates)
      .where(eq(kakeiboTemplates.userId, userId));
    if (n >= TEMPLATES_LIMIT) throw new HttpError(409, `よく使う記録は ${TEMPLATES_LIMIT} 個までです。`);

    const id = crypto.randomUUID();
    await db.insert(kakeiboTemplates).values({
      id,
      userId,
      groupId: input.groupId ?? null,
      name: input.name,
      type: input.type,
      category: input.category ?? null,
      accountId: account?.id ?? null,
      memo: input.memo || null,
      amount: input.amount ?? null,
    });
    const row = (await db.select().from(kakeiboTemplates).where(eq(kakeiboTemplates.id, id)).get())!;
    return c.json(toDto(row), 201);
  })
  .patch("/:id", zValidator("json", kakeiboTemplatePatchInput, validationHook), async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const current = await loadOwned(db, userId, c.req.param("id"));
    const input = c.req.valid("json");
    const type = input.type ?? current.type;
    const category = input.category ?? current.category;
    assertCategory(type, category);
    if (input.groupId !== undefined) await assertUsableGroup(db, userId, input.groupId);
    let accountId = current.accountId;
    if (input.accountId !== undefined) accountId = (await assertUsableAccount(db, userId, input.accountId))?.id ?? null;

    await db
      .update(kakeiboTemplates)
      .set({
        name: input.name ?? current.name,
        type,
        groupId: input.groupId === undefined ? current.groupId : input.groupId,
        category: category ?? null,
        accountId,
        memo: input.memo === undefined ? current.memo : input.memo || null,
        amount: input.amount === undefined ? current.amount : input.amount,
        updatedAt: new Date(),
      })
      .where(eq(kakeiboTemplates.id, current.id));
    const row = (await db.select().from(kakeiboTemplates).where(eq(kakeiboTemplates.id, current.id)).get())!;
    return c.json(toDto(row));
  })
  .delete("/:id", async (c) => {
    const db = c.get("db");
    const current = await loadOwned(db, c.get("user").id, c.req.param("id"));
    await db.delete(kakeiboTemplates).where(eq(kakeiboTemplates.id, current.id));
    return c.body(null, 204);
  });
