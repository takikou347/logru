import { createdAt, updatedAt } from "@server/core/db/columns";
import { groups, users } from "@server/core/db/schema";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** リストの表。拡張の約束のとおり、グループを持つ。日付は任意で、付けるとカレンダーに出る。0002、0054 */
export const lists = sqliteTable(
  "lists",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    /** `2026-09-22` の形。無ければカレンダーに出ない */
    date: text("date"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  // 日付の付いたリストを、期間で絞ってカレンダーへ渡すのに使う
  (t) => [index("lists_group_date_idx").on(t.groupId, t.date)],
);

/** リストの項目の表。list_id が指すリストを消すと、項目も消える。0054 */
export const listItems = sqliteTable(
  "list_items",
  {
    id: text("id").primaryKey(),
    listId: text("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    checked: integer("checked", { mode: "boolean" }).notNull().default(false),
    checkedBy: text("checked_by").references(() => users.id, { onDelete: "set null" }),
    checkedAt: integer("checked_at", { mode: "timestamp_ms" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  // 1 つのリストの項目を、足した順で引くのに使う
  (t) => [index("list_items_list_id_idx").on(t.listId, t.createdAt)],
);

/** 表の 1 行 */
export type ListRow = typeof lists.$inferSelect;
export type ListItemRow = typeof listItems.$inferSelect;
