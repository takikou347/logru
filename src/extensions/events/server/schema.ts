import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createdAt, updatedAt } from "../../../server/core/db/columns";
import { groups, users } from "../../../server/core/db/schema";

/** 予定の表。拡張の約束のとおり、日付とグループを持つ。0002 */
export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }),
    memo: text("memo"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  // カレンダーは期間とグループで引く
  (t) => [index("events_group_starts_idx").on(t.groupId, t.startsAt)],
);

/** 表の 1 行 */
export type EventRow = typeof events.$inferSelect;
