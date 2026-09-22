import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createdAt, updatedAt } from "@server/core/db/columns";
import { groups, users } from "@server/core/db/schema";

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

/**
 * 予定の参加者と、その返事。作った人もいつも入り、accepted にする。#28
 * 予定が消えると行も消える。退会すると、その人の行も消える。
 * グループを抜けた人の行は、groups の抜ける処理から onMemberLeave で消す。
 */
export const eventAttendees = sqliteTable(
  "event_attendees",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    response: text("response", { enum: ["pending", "accepted", "declined"] }).notNull().default("pending"),
    /** 返事をした時刻。まだなら空 */
    respondedAt: integer("responded_at", { mode: "timestamp_ms" }),
  },
  // 自分が招待された予定を引くため、人でも引けるようにする
  (t) => [primaryKey({ columns: [t.eventId, t.userId] }), index("event_attendees_user_idx").on(t.userId)],
);

/** 参加者の表の 1 行 */
export type EventAttendeeRow = typeof eventAttendees.$inferSelect;
