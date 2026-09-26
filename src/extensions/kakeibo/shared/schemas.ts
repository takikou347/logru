import { z } from "zod";
import { KAKEIBO_ACCOUNT_KIND_KEYS } from "./accounts";
import { KAKEIBO_CATEGORY_KEYS } from "./categories";
import { isDateKey, isMonthKey } from "./dates";
import { KAKEIBO_SPLIT_MODES } from "./splits";
import { KAKEIBO_TYPES } from "./types";

const fields = {
  type: z.enum(KAKEIBO_TYPES, { error: "種類を選んでください。" }),
  groupId: z.string().min(1, "記録するグループを選んでください。"),
  date: z.string().refine(isDateKey, "日付を入れてください。"),
  /** 円の整数。0 円や負の値、1 億円を超える額は断る。0069 */
  amount: z
    .number()
    .int("金額は整数で入れてください。")
    .min(1, "金額を入れてください。")
    .max(100_000_000, "金額は 1 億円までです。"),
  category: z.enum(KAKEIBO_CATEGORY_KEYS, { error: "カテゴリを選んでください。" }),
  accountId: z.string().min(1).nullable(),
  memo: z.string().max(200, "メモは 200 文字までです。").nullable(),
  userId: z.string().min(1),
};

/** 立て替えの、人ごとの負担額 1 件。1 人ずつ金額を指定する割り方(custom)で送る。0072、F-318 */
const splitShareInput = z.object({ userId: fields.userId, amount: z.number().int().min(0) });

/**
 * 記録するときの入力。種類ごとに要る項目が違う(支出・収入はグループとカテゴリ、振替は口座 2 つ)ので、
 * ここでは形だけを確かめ、組み合わせはルーターで確かめる。F-301、F-310、F-311
 *
 * PATCH も同じ形。振替のグループはサーバーが決めるので、常に送らなくてよい。0069
 *
 * paidBy・splitMode・splits は立て替えの入力。共有のグループの支出で、共有口座で払っていないときだけ使う。0072、F-318
 * splits は splitMode が custom のときだけ見る。グループの人数の上限(0065)に沿って 50 件までにする
 */
export const kakeiboInput = z.object({
  type: fields.type,
  groupId: fields.groupId.optional(),
  date: fields.date,
  amount: fields.amount,
  category: fields.category.optional(),
  accountId: fields.accountId.optional(),
  toAccountId: fields.accountId.optional(),
  memo: fields.memo.optional(),
  paidBy: fields.userId.nullable().optional(),
  splitMode: z.enum(KAKEIBO_SPLIT_MODES).nullable().optional(),
  splits: z.array(splitShareInput).max(50).optional(),
});

export type KakeiboInput = z.infer<typeof kakeiboInput>;

const accountFields = {
  name: z.string().trim().min(1, "名前を入れてください。").max(30, "名前は 30 文字までです。"),
  kind: z.enum(KAKEIBO_ACCOUNT_KIND_KEYS, { error: "種類を選んでください。" }),
  /** 円の整数。カードなど、マイナスの始まりの残高も許す。0069 */
  openingBalance: z
    .number()
    .int("残高は整数で入れてください。")
    .min(-100_000_000, "残高は -1 億円までです。")
    .max(100_000_000, "残高は 1 億円までです。"),
};

/** 口座を作るときの入力。F-309 */
export const kakeiboAccountInput = z.object({
  groupId: fields.groupId,
  name: accountFields.name,
  kind: accountFields.kind,
  openingBalance: accountFields.openingBalance,
});

/** 口座を直すときの入力。持ち主(groupId)は作った後は変えられない。F-309 */
export const kakeiboAccountPatchInput = z.object({
  name: accountFields.name.optional(),
  kind: accountFields.kind.optional(),
  openingBalance: accountFields.openingBalance.optional(),
  sortOrder: z.number().int().optional(),
  archived: z.boolean().optional(),
});

export type KakeiboAccountInput = z.infer<typeof kakeiboAccountInput>;
export type KakeiboAccountPatchInput = z.infer<typeof kakeiboAccountPatchInput>;

/** 精算したと記録するときの入力。口座は、それぞれ自分の口座だけ選べる(ルーターで確かめる)。0072、F-321 */
export const kakeiboSettlementInput = z
  .object({
    groupId: fields.groupId,
    fromUser: fields.userId,
    toUser: fields.userId,
    amount: fields.amount,
    date: fields.date,
    fromAccountId: fields.accountId.optional(),
    toAccountId: fields.accountId.optional(),
  })
  .refine((v) => v.fromUser !== v.toUser, {
    message: "送った人と受け取った人は、別の人にしてください。",
    path: ["toUser"],
  });

export type KakeiboSettlementInput = z.infer<typeof kakeiboSettlementInput>;

const budgetFields = {
  name: z.string().trim().min(1, "名前を入れてください。").max(30, "名前は 30 文字までです。"),
};

/** 期間の予算の入力。終わりの日は始まりの日以上。F-323 */
export const kakeiboBudgetInput = z
  .object({
    groupId: fields.groupId,
    name: budgetFields.name,
    startDate: fields.date,
    endDate: fields.date,
    amount: fields.amount,
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "終わりの日は、始まりの日と同じか後にしてください。",
    path: ["endDate"],
  });

export type KakeiboBudgetInput = z.infer<typeof kakeiboBudgetInput>;

/** 期間の予算を直すときの入力。グループは作った後は変えられない。F-323 */
export const kakeiboBudgetPatchInput = z
  .object({
    name: budgetFields.name.optional(),
    startDate: fields.date.optional(),
    endDate: fields.date.optional(),
    amount: fields.amount.optional(),
  })
  .refine((v) => !(v.startDate && v.endDate) || v.endDate >= v.startDate, {
    message: "終わりの日は、始まりの日と同じか後にしてください。",
    path: ["endDate"],
  });

export type KakeiboBudgetPatchInput = z.infer<typeof kakeiboBudgetPatchInput>;

const recurringFields = {
  dayOfMonth: z.number().int().min(1, "1 から 31 の日にしてください。").max(31, "1 から 31 の日にしてください。"),
  // `2026-13` のような、月が 1〜12 に収まらない値も断る。#198
  monthKey: z.string().refine(isMonthKey, "月を `2026-09` の形で入れてください。"),
};

/** 定期の記録の入力。種類ごとに要る項目は記録の入力と同じ。F-325 */
export const kakeiboRecurringInput = z
  .object({
    groupId: fields.groupId,
    type: fields.type,
    amount: fields.amount,
    category: fields.category.optional(),
    accountId: fields.accountId.optional(),
    toAccountId: fields.accountId.optional(),
    memo: fields.memo.optional(),
    dayOfMonth: recurringFields.dayOfMonth,
    startMonth: recurringFields.monthKey,
    endMonth: recurringFields.monthKey.nullable().optional(),
  })
  // 終わりの月が始まりの月より前も断る。#198
  .refine((v) => !v.endMonth || v.endMonth >= v.startMonth, {
    message: "終わりの月は、始まりの月と同じか後にしてください。",
    path: ["endMonth"],
  });

export type KakeiboRecurringInput = z.infer<typeof kakeiboRecurringInput>;

/** 定期の記録を直すときの入力。送った項目だけ確かめる。F-325 */
export const kakeiboRecurringPatchInput = z
  .object({
    type: fields.type.optional(),
    amount: fields.amount.optional(),
    category: fields.category.optional(),
    accountId: fields.accountId.optional(),
    toAccountId: fields.accountId.optional(),
    memo: fields.memo.optional(),
    dayOfMonth: recurringFields.dayOfMonth.optional(),
    startMonth: recurringFields.monthKey.optional(),
    endMonth: recurringFields.monthKey.nullable().optional(),
    paused: z.boolean().optional(),
  })
  // 直すときも、送った項目の組み合わせで終わりの月を確かめる。budget の patch と同じ形。#198
  .refine((v) => !(v.startMonth && v.endMonth) || v.endMonth >= v.startMonth, {
    message: "終わりの月は、始まりの月と同じか後にしてください。",
    path: ["endMonth"],
  });

export type KakeiboRecurringPatchInput = z.infer<typeof kakeiboRecurringPatchInput>;

/** よく使う記録の入力。金額は省ける。F-326 */
export const kakeiboTemplateInput = z.object({
  name: z.string().trim().min(1, "名前を入れてください。").max(30, "名前は 30 文字までです。"),
  type: fields.type,
  groupId: fields.groupId.optional(),
  category: fields.category.optional(),
  accountId: fields.accountId.optional(),
  toAccountId: fields.accountId.optional(),
  memo: fields.memo.optional(),
  amount: fields.amount.nullable().optional(),
});

export type KakeiboTemplateInput = z.infer<typeof kakeiboTemplateInput>;

/** よく使う記録を直すときの入力。送った項目だけ確かめる。F-326 */
export const kakeiboTemplatePatchInput = z.object({
  name: z.string().trim().min(1, "名前を入れてください。").max(30, "名前は 30 文字までです。").optional(),
  type: fields.type.optional(),
  groupId: fields.groupId.nullable().optional(),
  category: fields.category.optional(),
  accountId: fields.accountId.optional(),
  toAccountId: fields.accountId.optional(),
  memo: fields.memo.optional(),
  amount: fields.amount.nullable().optional(),
});

export type KakeiboTemplatePatchInput = z.infer<typeof kakeiboTemplatePatchInput>;
