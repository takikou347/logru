import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createdAt, updatedAt } from "@server/core/db/columns";
import { users } from "@server/core/db/schema";

/**
 * 外部のカレンダー。1 人がいくつでも登録できる。
 * URL を知られると予定が見えるので、暗号にして持つ。画面には返さない
 */
export const externalCalendars = sqliteTable(
  "external_calendars",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    /** AES-GCM で暗号にした URL。crypto.ts の形 */
    urlEncrypted: text("url_encrypted").notNull(),
    /** 最後に読めた時刻 */
    lastSyncedAt: integer("last_synced_at", { mode: "timestamp_ms" }),
    /** 最後に読んだときの失敗。読めたら空にする */
    lastError: text("last_error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("external_calendars_user_idx").on(t.userId)],
);

/**
 * 外部のカレンダーから読んだ予定。繰り返しは 1 回ずつに開いて持つ。
 * 読み直すたびに、そのカレンダーの行をすべて入れ替える
 */
export const externalEvents = sqliteTable(
  "external_events",
  {
    calendarId: text("calendar_id")
      .notNull()
      .references(() => externalCalendars.id, { onDelete: "cascade" }),
    /** iCal の UID */
    uid: text("uid").notNull(),
    /** 繰り返しの何回目か。元の始まりの時刻。繰り返さなければ始まりの時刻 */
    occurrence: integer("occurrence").notNull(),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }),
    allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
    title: text("title").notNull(),
    location: text("location"),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.calendarId, t.uid, t.occurrence] }),
    index("external_events_calendar_starts_idx").on(t.calendarId, t.startsAt),
  ],
);

/** 外部のカレンダーの 1 行 */
export type ExternalCalendarRow = typeof externalCalendars.$inferSelect;
