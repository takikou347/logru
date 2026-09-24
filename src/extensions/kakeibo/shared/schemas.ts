import { z } from "zod";
import { KAKEIBO_ACCOUNT_KIND_KEYS } from "./accounts";
import { KAKEIBO_CATEGORY_KEYS } from "./categories";
import { isDateKey } from "./dates";
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
};

/**
 * 記録するときの入力。種類ごとに要る項目が違う(支出・収入はグループとカテゴリ、振替は口座 2 つ)ので、
 * ここでは形だけを確かめ、組み合わせはルーターで確かめる。F-301、F-310、F-311
 *
 * PATCH も同じ形。振替のグループはサーバーが決めるので、常に送らなくてよい。0069
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
