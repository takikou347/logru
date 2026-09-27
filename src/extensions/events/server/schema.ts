import { createdAt, updatedAt } from "@server/core/db/columns";
import { groups, users } from "@server/core/db/schema";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
    /** 繰り返しの周期。空なら繰り返さない。0043 */
    repeatFreq: text("repeat_freq", { enum: ["daily", "weekly", "monthly", "yearly"] }),
    /** 毎週だけで使う。月を 1、日を 7 とした数の配列。JSON で持つ。0043 */
    repeatDaysOfWeek: text("repeat_days_of_week", { mode: "json" }).$type<number[]>(),
    /** 繰り返しの終わりの日。repeat_count と同時には入らない。0043 */
    repeatUntil: integer("repeat_until", { mode: "timestamp_ms" }),
    /** 繰り返しの終わりの回数。repeat_until と同時には入らない。0043 */
    repeatCount: integer("repeat_count"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  // カレンダーは期間とグループで引く
  (t) => [index("events_group_starts_idx").on(t.groupId, t.startsAt)],
);

/** 表の 1 行 */
export type EventRow = typeof events.$inferSelect;

/**
 * 繰り返しの回のうち、直したか取り消した回だけの行。0043
 *
 * occurrence_at は、直す前の規則どおりの始まりの時刻。cancelled が真ならその回を出さない。
 * ほかの列は直した値だけが入り、空なら events の値をそのまま使う。
 */
export const eventOccurrenceEdits = sqliteTable(
  "event_occurrence_edits",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    occurrenceAt: integer("occurrence_at", { mode: "timestamp_ms" }).notNull(),
    cancelled: integer("cancelled", { mode: "boolean" }).notNull().default(false),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }),
    allDay: integer("all_day", { mode: "boolean" }),
    title: text("title"),
    memo: text("memo"),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.occurrenceAt] }),
    index("event_occurrence_edits_event_idx").on(t.eventId),
  ],
);

/** 直しと取り消しの表の 1 行 */
export type EventOccurrenceEditRow = typeof eventOccurrenceEdits.$inferSelect;

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
    response: text("response", { enum: ["pending", "accepted", "declined"] })
      .notNull()
      .default("pending"),
    /** 返事をした時刻。まだなら空 */
    respondedAt: integer("responded_at", { mode: "timestamp_ms" }),
  },
  // 自分が招待された予定を引くため、人でも引けるようにする
  (t) => [primaryKey({ columns: [t.eventId, t.userId] }), index("event_attendees_user_idx").on(t.userId)],
);

/** 参加者の表の 1 行 */
export type EventAttendeeRow = typeof eventAttendees.$inferSelect;
