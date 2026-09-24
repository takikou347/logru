import { createdAt, updatedAt } from "@server/core/db/columns";
import { groups, users } from "@server/core/db/schema";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { KAKEIBO_ACCOUNT_KIND_KEYS } from "../shared/accounts";
import { KAKEIBO_CATEGORY_KEYS } from "../shared/categories";
import { KAKEIBO_TYPES } from "../shared/types";

/**
 * 口座。group_id が自分だけのグループなら自分の口座、共有のグループなら共有口座。0069
 * 移行 0023
 */
export const kakeiboAccounts = sqliteTable(
  "kakeibo_accounts",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    /** 1 から 30 字 */
    name: text("name").notNull(),
    kind: text("kind", { enum: KAKEIBO_ACCOUNT_KIND_KEYS }).notNull(),
    /** 円の整数。-1 億から 1 億。カードはマイナスの始まりの残高も許す */
    openingBalance: integer("opening_balance").notNull().default(0),
    /** 口座の一覧の並び。小さいほど先 */
    sortOrder: integer("sort_order").notNull().default(0),
    /** 入っていれば「使わない」。新しい記録では選べなくなるが、記録と残高は残る。F-309 */
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  // 口座の一覧を、使えるグループで絞るのに使う
  (t) => [index("kakeibo_accounts_group_idx").on(t.groupId)],
);

/** 表の 1 行 */
export type KakeiboAccountRow = typeof kakeiboAccounts.$inferSelect;

/**
 * 記録。支出・収入・振替の 3 種類を、この 1 つの表に持つ。表の名前は最初の版から変えない。0047、0069
 * 移行 0023 で type、account_id、to_account_id を足した。それより前の行は type が expense、口座は空
 */
export const kakeiboExpenses = sqliteTable(
  "kakeibo_expenses",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    type: text("type", { enum: KAKEIBO_TYPES }).notNull().default("expense"),
    /** `2026-09-22` の形。時刻は持たない */
    date: text("date").notNull(),
    /** 円の整数 */
    amount: integer("amount").notNull(),
    /** 支出・収入のカテゴリ、または `transfer` */
    category: text("category", { enum: KAKEIBO_CATEGORY_KEYS }).notNull(),
    /** 支出は払った口座、収入は入れた口座、振替は出す元。口座が消えると空になる */
    accountId: text("account_id").references(() => kakeiboAccounts.id, { onDelete: "set null" }),
    /** 振替の入れる先。支出・収入は空 */
    toAccountId: text("to_account_id").references(() => kakeiboAccounts.id, { onDelete: "set null" }),
    memo: text("memo"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // 月ごとの合計と、カレンダーへ渡す日ごとの合計を、グループと日付で引く
    index("kakeibo_expenses_group_date_idx").on(t.groupId, t.date),
    // 口座ごとの記録と残高を、口座で引く。振替は入れる先でも引く
    index("kakeibo_expenses_account_idx").on(t.accountId),
    index("kakeibo_expenses_to_account_idx").on(t.toAccountId),
  ],
);

/** 表の 1 行 */
export type KakeiboExpenseRow = typeof kakeiboExpenses.$inferSelect;
