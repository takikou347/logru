import { createdAt, updatedAt } from "@server/core/db/columns";
import { groups, users } from "@server/core/db/schema";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { KAKEIBO_CATEGORY_KEYS } from "../shared/categories";

/** 支出の表。拡張の約束のとおり、日付とグループを持つ。0002、0047 */
export const kakeiboExpenses = sqliteTable(
  "kakeibo_expenses",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    /** `2026-09-22` の形。時刻は持たない */
    date: text("date").notNull(),
    /** 円の整数 */
    amount: integer("amount").notNull(),
    category: text("category", { enum: KAKEIBO_CATEGORY_KEYS }).notNull(),
    memo: text("memo"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  // 月ごとの合計と、カレンダーへ渡す日ごとの合計を、グループと日付で引く
  (t) => [index("kakeibo_expenses_group_date_idx").on(t.groupId, t.date)],
);

/** 表の 1 行 */
export type KakeiboExpenseRow = typeof kakeiboExpenses.$inferSelect;
