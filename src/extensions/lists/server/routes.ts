import { zValidator } from "@hono/zod-validator";
import { createRouter, HttpError, validationHook } from "@server/core/app";
import { requireAgreement, requireUser } from "@server/core/auth/middleware";
import type { DB } from "@server/core/db/client";
import { and, desc, eq, inArray } from "drizzle-orm";
import { listInput, listItemInput, listItemPatchInput, listPatchInput } from "../shared/schemas";
import { requireListsGroup, usableGroupIds } from "./access";
import { type ListItemRow, type ListRow, listItems, lists } from "./schema";

/** 一度に返すリストの上限。個人か少人数の想定なので十分な余白を取る */
const LISTS_LIMIT = 200;

/** 1 つのリストに持てる項目の上限 */
const ITEMS_LIMIT = 300;

/** 項目の数から、合計と残りを数える */
function countsOf(items: Pick<ListItemRow, "checked">[]): { itemCount: number; remainingCount: number } {
  return { itemCount: items.length, remainingCount: items.filter((i) => !i.checked).length };
}

/** リストの表の 1 行を、画面に返す形にする */
function toListDto(row: ListRow, counts: { itemCount: number; remainingCount: number }) {
  return {
    id: row.id,
    groupId: row.groupId,
    createdBy: row.createdBy,
    title: row.title,
    date: row.date,
    itemCount: counts.itemCount,
    remainingCount: counts.remainingCount,
    createdAt: row.createdAt.getTime(),
  };
}

/** 項目の表の 1 行を、画面に返す形にする */
function toItemDto(row: ListItemRow) {
  return {
    id: row.id,
    listId: row.listId,
    text: row.text,
    checked: row.checked,
    checkedBy: row.checkedBy,
    checkedAt: row.checkedAt?.getTime() ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.getTime(),
  };
}

/**
 * リストを読み、使えるグループのものか確かめる。無ければ 404、グループが使えなければ 404。F-206
 * グループのメンバーなら、誰でも読める、直せる。0054
 * @param db D1 を包んだ Drizzle
 * @param userId 読もうとする人
 * @param id リストの ID
 */
async function loadUsableList(db: DB, userId: string, id: string): Promise<ListRow> {
  const row = await db.select().from(lists).where(eq(lists.id, id)).get();
  if (!row) throw new HttpError(404, "見つかりません。");
  await requireListsGroup(db, userId, row.groupId);
  return row;
}

/** そのリストの項目を 1 件読む。無ければ 404 */
async function loadItem(db: DB, listId: string, itemId: string): Promise<ListItemRow> {
  const row = await db
    .select()
    .from(listItems)
    .where(and(eq(listItems.id, itemId), eq(listItems.listId, listId)))
    .get();
  if (!row) throw new HttpError(404, "見つかりません。");
  return row;
}

/**
 * `/api/lists`。リストを作る、一覧を読む、直す、消す。項目を足す、チェックする、消す。F-201〜F-207
 *
 * 読めるのは、リストを使うと決めた人が、使うと決めたグループのメンバーだけ。
 * 直せて、消せるのは、そのグループのメンバーなら誰でもよい。0054
 */
export const listsRoutes = createRouter()
  .use("*", requireUser, requireAgreement)
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
            .from(lists)
            .where(inArray(lists.groupId, groupIds))
            .orderBy(desc(lists.createdAt), desc(lists.id))
            .limit(LISTS_LIMIT);
    const items =
      rows.length === 0
        ? []
        : await db
            .select({ listId: listItems.listId, checked: listItems.checked })
            .from(listItems)
            .where(
              inArray(
                listItems.listId,
                rows.map((r) => r.id),
              ),
            );
    const byList = new Map<string, Pick<ListItemRow, "checked">[]>();
    for (const item of items) byList.set(item.listId, [...(byList.get(item.listId) ?? []), item]);

    return c.json({ lists: rows.map((r) => toListDto(r, countsOf(byList.get(r.id) ?? []))) });
  })
  .post("/", zValidator("json", listInput, validationHook), async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const input = c.req.valid("json");
    await requireListsGroup(db, userId, input.groupId);
    const id = crypto.randomUUID();
    await db
      .insert(lists)
      .values({ id, groupId: input.groupId, createdBy: userId, title: input.title, date: input.date ?? null });
    const row = await db.select().from(lists).where(eq(lists.id, id)).get();
    return c.json(toListDto(row!, countsOf([])), 201);
  })
  .get("/:id", async (c) => {
    const db = c.get("db");
    const list = await loadUsableList(db, c.get("user").id, c.req.param("id"));
    const items = await db
      .select()
      .from(listItems)
      .where(eq(listItems.listId, list.id))
      .orderBy(listItems.createdAt, listItems.id)
      .limit(ITEMS_LIMIT);
    return c.json({ ...toListDto(list, countsOf(items)), items: items.map(toItemDto) });
  })
  .patch("/:id", zValidator("json", listPatchInput, validationHook), async (c) => {
    const db = c.get("db");
    const current = await loadUsableList(db, c.get("user").id, c.req.param("id"));
    const input = c.req.valid("json");
    await db
      .update(lists)
      .set({
        title: input.title ?? current.title,
        date: input.date === undefined ? current.date : input.date,
        updatedAt: new Date(),
      })
      .where(eq(lists.id, current.id));
    const row = await db.select().from(lists).where(eq(lists.id, current.id)).get();
    const items = await db.select().from(listItems).where(eq(listItems.listId, current.id));
    return c.json({ ...toListDto(row!, countsOf(items)), items: items.map(toItemDto) });
  })
  .delete("/:id", async (c) => {
    const db = c.get("db");
    const current = await loadUsableList(db, c.get("user").id, c.req.param("id"));
    await db.delete(lists).where(eq(lists.id, current.id));
    return c.body(null, 204);
  })
  .post("/:id/items", zValidator("json", listItemInput, validationHook), async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const list = await loadUsableList(db, userId, c.req.param("id"));
    const input = c.req.valid("json");
    const id = crypto.randomUUID();
    await db.insert(listItems).values({ id, listId: list.id, text: input.text, createdBy: userId });
    const row = await db.select().from(listItems).where(eq(listItems.id, id)).get();
    return c.json(toItemDto(row!), 201);
  })
  .patch("/:id/items/:itemId", zValidator("json", listItemPatchInput, validationHook), async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const list = await loadUsableList(db, userId, c.req.param("id"));
    const item = await loadItem(db, list.id, c.req.param("itemId"));
    const input = c.req.valid("json");
    await db
      .update(listItems)
      .set({
        checked: input.checked,
        checkedBy: input.checked ? userId : null,
        checkedAt: input.checked ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(listItems.id, item.id));
    const row = await db.select().from(listItems).where(eq(listItems.id, item.id)).get();
    return c.json(toItemDto(row!));
  })
  .delete("/:id/items/:itemId", async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const list = await loadUsableList(db, userId, c.req.param("id"));
    const item = await loadItem(db, list.id, c.req.param("itemId"));
    await db.delete(listItems).where(eq(listItems.id, item.id));
    return c.body(null, 204);
  });
