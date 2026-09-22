import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createdAt, now, updatedAt } from "@server/core/db/columns";
import { groups, users } from "@server/core/db/schema";

/**
 * 思い出。グループと期間を持つ 1 冊。0020
 * starts_at は初日の 0 時、ends_at は最後の日の次の 0 時で、含まない。どちらも time_zone での 0 時。
 */
export const memories = sqliteTable(
  "memories",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    place: text("place"),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    timeZone: text("time_zone").notNull(),
    /** 表紙の写真。消えた写真を指したら、最初の写真を表紙にする */
    coverPhotoId: text("cover_photo_id"),
    komaEnabled: integer("koma_enabled", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("memories_group_starts_idx").on(t.groupId, t.startsAt)],
);

/**
 * しおりの行。やりたいこと、やること、持ち物。0020
 * place と day_index は wish だけ。assignee_id は todo と packing だけ。due_on は todo だけ。
 */
export const memoryItems = sqliteTable(
  "memory_items",
  {
    id: text("id").primaryKey(),
    memoryId: text("memory_id")
      .notNull()
      .references(() => memories.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["wish", "todo", "packing"] }).notNull(),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    place: text("place"),
    /** 初日を 0 とする日の番号。空なら「通して」 */
    dayIndex: integer("day_index"),
    /** 担当する人。空なら「みんな」 */
    assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
    /** 期限。`2026-10-03` の形 */
    dueOn: text("due_on"),
    sortOrder: integer("sort_order").notNull().default(0),
    doneAt: integer("done_at", { mode: "timestamp_ms" }),
    doneBy: text("done_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("memory_items_memory_idx").on(t.memoryId)],
);

/**
 * 記録。グループと日時に属し、思い出の ID は持たない。0020
 * ひとコマも記録の 1 種で、kind が koma。koma_slot は枠の始まりの時刻。0022
 */
export const memoryRecords = sqliteTable(
  "memory_records",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    kind: text("kind", { enum: ["note", "koma"] }).notNull().default("note"),
    body: text("body"),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
    komaSlot: integer("koma_slot", { mode: "timestamp_ms" }),
    /** この記録で済ませたやりたいこと */
    itemId: text("item_id").references(() => memoryItems.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("memory_records_group_occurred_idx").on(t.groupId, t.occurredAt),
    // 1 人 1 枠 1 枚を表で守る。note は koma_slot が空なので重ならない
    uniqueIndex("memory_records_koma_uniq").on(t.createdBy, t.komaSlot),
  ],
);

/**
 * 写真。full と thumb は R2 に置き、鍵は id から決まる。tiny は 32 px の JPEG を base64 にした文字列。0021
 * record_id が空なら、まだ記録に付いていない写真。24 時間たっても付かなければ定期の処理が消す。
 * 行を消すと、トリガーが R2 の鍵を memory_photo_trash に積む。
 */
export const memoryPhotos = sqliteTable(
  "memory_photos",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    recordId: text("record_id").references(() => memoryRecords.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    bytes: integer("bytes").notNull(),
    takenAt: integer("taken_at", { mode: "timestamp_ms" }),
    tiny: text("tiny").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("memory_photos_record_idx").on(t.recordId), index("memory_photos_group_idx").on(t.groupId)],
);

/** 記録へのいいね。1 人 1 回。F-116 */
export const memoryLikes = sqliteTable(
  "memory_likes",
  {
    recordId: text("record_id")
      .notNull()
      .references(() => memoryRecords.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.recordId, t.userId] })],
);

/** R2 から消すのを待つ鍵。memory_photos の行が消えると、移行の中のトリガーが積む。0021 */
export const memoryPhotoTrash = sqliteTable("memory_photo_trash", {
  key: text("key").primaryKey(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }).notNull().default(now),
});

export type MemoryRow = typeof memories.$inferSelect;
export type MemoryItemRow = typeof memoryItems.$inferSelect;
export type MemoryRecordRow = typeof memoryRecords.$inferSelect;
export type MemoryPhotoRow = typeof memoryPhotos.$inferSelect;

/**
 * ひとコマを始めた日と、つなぎ先。人と日ごとに 1 行。0022
 * 思い出でひとコマを有効にした日は、その思い出とグループに自動でつながる。自分で始めた日は、既定が自分だけで思い出なし。
 * memory_id は思い出を消すと空になる。写真は残る。
 */
export const memoryKomaDays = sqliteTable(
  "memory_koma_days",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** `2026-09-22` の形。time_zone での日付 */
    day: text("day").notNull(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    memoryId: text("memory_id").references(() => memories.id, { onDelete: "set null" }),
    timeZone: text("time_zone").notNull(),
    /** その日は知らせない */
    muted: integer("muted", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] }), index("memory_koma_days_day_idx").on(t.day)],
);

/** その枠の知らせを送ったしるし。2 重に送らないために持つ */
export const memoryKomaNotices = sqliteTable(
  "memory_koma_notices",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slot: integer("slot", { mode: "timestamp_ms" }).notNull(),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.userId, t.slot] })],
);

export type KomaDayRow = typeof memoryKomaDays.$inferSelect;

/**
 * 思い出から外した予定。0020
 * 思い出には、期間に重なる同じグループの予定が自動で入る。外したい予定だけを、ここに持つ。
 * 予定は予定の拡張の表にあるので、外部キーは張らない。予定が消えた行は、読むときに無視する。
 */
export const memoryEventExclusions = sqliteTable(
  "memory_event_exclusions",
  {
    memoryId: text("memory_id")
      .notNull()
      .references(() => memories.id, { onDelete: "cascade" }),
    eventId: text("event_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.memoryId, t.eventId] })],
);
