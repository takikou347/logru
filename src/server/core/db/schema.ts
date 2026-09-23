/**
 * 土台の表。拡張の表は src/extensions/<名前>/server/schema.ts に置く。
 * 日時はすべてミリ秒の UTC で持つ。
 */

import { createdAt, now, updatedAt } from "@server/core/db/columns";
import type { HomeWidgetEntry } from "@shared/api-types";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** 利用者。ID は Firebase の利用者 ID。ログインの情報そのものは Firebase にある */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** 利用者ごとの表示の設定。F-13、F-14 */
export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  themeMode: text("theme_mode", { enum: ["system", "light", "dark"] })
    .notNull()
    .default("system"),
  /** 背景のテーマ。ガラスは奥を透かす、平らは透かさず塗る。#50 */
  bgTheme: text("bg_theme", { enum: ["glass", "flat"] })
    .notNull()
    .default("glass"),
  accentColor: text("accent_color").notNull().default("aizumi"),
  userColor: text("user_color").notNull().default("wakatake"),
  /** アバターの出し方。既定は頭文字。#40 */
  avatarKind: text("avatar_kind", { enum: ["initial", "photo"] })
    .notNull()
    .default("initial"),
  /** いま置いている写真の R2 の鍵の乱数の部分。置き直すたびに変わる。頭文字のときは空 */
  avatarPhotoKey: text("avatar_photo_key"),
  /** いま置いている写真の大きさ。R2 に聞かず、写真とアバターの合計を D1 だけで測るために持つ。0066 */
  avatarBytes: integer("avatar_bytes").notNull().default(0),
  updatedAt: updatedAt(),
  /** はじめての案内を見終えたか、飛ばした日時。空なら次にカレンダーを開いたとき出す。F-32、0035 */
  onboardedAt: integer("onboarded_at", { mode: "timestamp_ms" }),
  /** 案内を見た画面の ID。F-33 */
  toursSeen: text("tours_seen", { mode: "json" }).$type<string[]>().notNull().default([]),
  /**
   * 足した機能のタイルの並び。key の配列。まだ並びを持たない(新しく足した)機能は、末尾に自動で足す。0058
   * 移行 0019
   */
  extensionOrder: text("extension_order", { mode: "json" }).$type<string[]>().notNull().default([]),
});

/** 規約に同意した版。最新の版の行が無ければ同意を取り直す。F-16 */
export const legalAgreements = sqliteTable(
  "legal_agreements",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    document: text("document", { enum: ["terms", "privacy"] }).notNull(),
    version: text("version").notNull(),
    agreedAt: integer("agreed_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.userId, t.document, t.version] })],
);

/** 自分の画面だけの色。F-15、F-18 */
export const colorPrefs = sqliteTable(
  "color_prefs",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type", { enum: ["group", "user"] }).notNull(),
    targetId: text("target_id").notNull(),
    color: text("color").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.targetType, t.targetId] })],
);

/** カレンダーに出す人の選択。自分の画面だけの設定。hidden が true の人が作った項目を出さない。F-20 */
export const memberVisibility = sqliteTable(
  "member_visibility",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetUserId: text("target_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.targetUserId] })],
);

/** グループ。登録した人には自分だけのグループを 1 つ作る。0009 */
export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  isPersonal: integer("is_personal", { mode: "boolean" }).notNull().default(false),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** グループのメンバーと役割 */
export const groupMembers = sqliteTable(
  "group_members",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["admin", "member"] })
      .notNull()
      .default("member"),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] }), index("group_members_user_idx").on(t.userId)],
);

/** 招待リンク。7 日で切れる。取り消しもできる */
export const groupInvites = sqliteTable("group_invites", {
  id: text("id").primaryKey(),
  groupId: text("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
});

/** グループごとの拡張の有効と無効。無効にしても行は消さない。F-11 */
export const groupExtensions = sqliteTable(
  "group_extensions",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    extensionKey: text("extension_key").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.extensionKey] })],
);

/** ホームのウィジェットの並び。自分の画面だけの設定。PC とスマホで別の行を持つ。F-28、0029 */
export const homeLayouts = sqliteTable(
  "home_layouts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    form: text("form", { enum: ["desktop", "mobile"] }).notNull(),
    /** key の並び。ウィジェットの中身も大きさも持たない。0037 */
    widgets: text("widgets", { mode: "json" }).$type<HomeWidgetEntry[]>().notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.form] })],
);

/** 端末に知らせを届ける送り先。端末ごとに 1 行。1 人 10 台まで。F-23、0023 */
export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    /** 設定の画面で見分けるための、端末の種類 */
    userAgent: text("user_agent"),
    /** 続けて失敗した数。5 回続いたら消す */
    failedCount: integer("failed_count").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId)],
);

/**
 * お知らせの一覧に積む 1 件。拡張が土台の notify() で積む。押した端末に知らせる push とは別物。#32
 * kind は `<拡張の key>.<拡張が決めた名前>` の形にする。文言と行き先は、積んだ拡張の describeNotification が決める
 */
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    payload: text("payload", { mode: "json" }).notNull(),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("notifications_user_created_idx").on(t.userId, t.createdAt),
    index("notifications_user_unread_idx").on(t.userId, t.readAt),
    // 90 日を過ぎた行を消す定期処理は利用者をまたいで created_at だけで探すので、単独の索引も要る。0066
    index("notifications_created_idx").on(t.createdAt),
  ],
);
