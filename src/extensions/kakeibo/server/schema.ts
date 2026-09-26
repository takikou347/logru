import { createdAt, updatedAt } from "@server/core/db/columns";
import { groups, users } from "@server/core/db/schema";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { KAKEIBO_ACCOUNT_KIND_KEYS } from "../shared/accounts";
import { KAKEIBO_CATEGORY_KEYS } from "../shared/categories";
import { KAKEIBO_SPLIT_MODES } from "../shared/splits";
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
    /** 払った人。共有のグループの支出で、共有口座で払っていないときだけ入る。0072、F-318 */
    paidBy: text("paid_by").references(() => users.id, { onDelete: "set null" }),
    /** 割り方。paidBy と同じ条件のときだけ入る。ほかは空 */
    splitMode: text("split_mode", { enum: KAKEIBO_SPLIT_MODES }),
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

/**
 * 立て替えの、人ごとの負担額。記録を保存するときに行を作り直す。合計は記録の金額と同じ。0072、F-318
 * 記録が消えると消える。負担した人がアカウントを消すと、その行の user_id だけが空になる
 */
export const kakeiboSplits = sqliteTable(
  "kakeibo_splits",
  {
    id: text("id").primaryKey(),
    expenseId: text("expense_id")
      .notNull()
      .references(() => kakeiboExpenses.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    amount: integer("amount").notNull(),
  },
  // 記録を保存し直すとき、その記録の負担の行をまとめて消してから作り直すのに使う
  (t) => [index("kakeibo_splits_expense_idx").on(t.expenseId)],
);

/** 表の 1 行 */
export type KakeiboSplitRow = typeof kakeiboSplits.$inferSelect;

/**
 * 精算した記録。送った人・受け取った人・金額・日付を持つ。口座はそれぞれ自分の口座で、省ける。0072、F-321
 */
export const kakeiboSettlements = sqliteTable(
  "kakeibo_settlements",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    fromUser: text("from_user").references(() => users.id, { onDelete: "set null" }),
    toUser: text("to_user").references(() => users.id, { onDelete: "set null" }),
    /** 円の整数 */
    amount: integer("amount").notNull(),
    /** `2026-09-22` の形 */
    date: text("date").notNull(),
    fromAccountId: text("from_account_id").references(() => kakeiboAccounts.id, { onDelete: "set null" }),
    toAccountId: text("to_account_id").references(() => kakeiboAccounts.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  // グループの精算の一覧を引くのに使う
  (t) => [index("kakeibo_settlements_group_idx").on(t.groupId)],
);

/** 表の 1 行 */
export type KakeiboSettlementRow = typeof kakeiboSettlements.$inferSelect;

/**
 * 期間の予算。グループ、名前、始まりと終わりの日、金額を持つ。家計簿の中に閉じる(0002)。0072、F-323
 */
export const kakeiboBudgets = sqliteTable(
  "kakeibo_budgets",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    /** 1 から 30 字 */
    name: text("name").notNull(),
    /** `2026-09-22` の形。終わりの日を含む */
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    /** 円の整数 */
    amount: integer("amount").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("kakeibo_budgets_group_idx").on(t.groupId)],
);

/** 表の 1 行 */
export type KakeiboBudgetRow = typeof kakeiboBudgets.$inferSelect;

/**
 * 定期の記録。毎月決めた日に、毎日の定期の処理(server/scheduled.ts)が記録を 1 件入れる。0072、F-325
 * 移行 0025
 */
export const kakeiboRecurrings = sqliteTable(
  "kakeibo_recurrings",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    type: text("type", { enum: KAKEIBO_TYPES }).notNull(),
    /** 円の整数 */
    amount: integer("amount").notNull(),
    /** 支出・収入のカテゴリ、または振替の `transfer` */
    category: text("category", { enum: KAKEIBO_CATEGORY_KEYS }).notNull(),
    accountId: text("account_id").references(() => kakeiboAccounts.id, { onDelete: "set null" }),
    toAccountId: text("to_account_id").references(() => kakeiboAccounts.id, { onDelete: "set null" }),
    memo: text("memo"),
    /** 毎月の日。1〜31。31 は月末として扱う */
    dayOfMonth: integer("day_of_month").notNull(),
    /** `2026-09` の形。この月から動く */
    startMonth: text("start_month").notNull(),
    /** `2026-09` の形。この月まで動く。無ければ終わりを決めていない */
    endMonth: text("end_month"),
    /** 最後に記録を入れた月。同じ月に 2 回入れないために見る。0072 */
    lastMonth: text("last_month"),
    /** 入っていれば止めている */
    pausedAt: integer("paused_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  // 毎日の定期の処理が、動いている定期の記録をグループを問わず総なめするのに使う
  (t) => [index("kakeibo_recurrings_group_idx").on(t.groupId)],
);

/** 表の 1 行 */
export type KakeiboRecurringRow = typeof kakeiboRecurrings.$inferSelect;

/**
 * よく使う記録。本人のものだけ。記録のシートの上にチップで並べ、押すと欄が埋まる。0072、F-326
 * 移行 0025
 */
export const kakeiboTemplates = sqliteTable(
  "kakeibo_templates",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    groupId: text("group_id").references(() => groups.id, { onDelete: "set null" }),
    /** 1 から 30 字 */
    name: text("name").notNull(),
    type: text("type", { enum: KAKEIBO_TYPES }).notNull(),
    category: text("category", { enum: KAKEIBO_CATEGORY_KEYS }),
    accountId: text("account_id").references(() => kakeiboAccounts.id, { onDelete: "set null" }),
    toAccountId: text("to_account_id").references(() => kakeiboAccounts.id, { onDelete: "set null" }),
    memo: text("memo"),
    /** 円の整数。省ける */
    amount: integer("amount"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  // 本人のよく使う記録の一覧を引くのに使う
  (t) => [index("kakeibo_templates_user_idx").on(t.userId)],
);

/** 表の 1 行 */
export type KakeiboTemplateRow = typeof kakeiboTemplates.$inferSelect;
