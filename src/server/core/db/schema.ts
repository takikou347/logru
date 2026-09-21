/**
 * 土台の表。拡張の表は src/extensions/<名前>/server/schema.ts に置く。
 * 日時はすべてミリ秒の UTC で持つ。
 */
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createdAt, now, updatedAt } from "./columns";

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
  themeMode: text("theme_mode", { enum: ["system", "light", "dark"] }).notNull().default("system"),
  accentColor: text("accent_color").notNull().default("aizumi"),
  userColor: text("user_color").notNull().default("wakatake"),
  updatedAt: updatedAt(),
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
    role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
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
