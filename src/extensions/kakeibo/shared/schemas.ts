import { z } from "zod";
import { KAKEIBO_CATEGORY_KEYS } from "./categories";
import { isDateKey } from "./dates";

const fields = {
  groupId: z.string().min(1, "記録するグループを選んでください。"),
  date: z.string().refine(isDateKey, "日付を入れてください。"),
  /** 円の整数。0 円や負の値、100 万円を超える額は断る。F-301 */
  amount: z
    .number()
    .int("金額は整数で入れてください。")
    .min(1, "金額を入れてください。")
    .max(1_000_000, "金額は 100 万円までです。"),
  category: z.enum(KAKEIBO_CATEGORY_KEYS, { error: "カテゴリを選んでください。" }),
  memo: z.string().max(200, "メモは 200 文字までです。").nullable(),
};

/** 支出を記録するときの入力。F-301 */
export const kakeiboInput = z.object({
  groupId: fields.groupId,
  date: fields.date,
  amount: fields.amount,
  category: fields.category,
  memo: fields.memo.optional(),
});

/** 支出を直すときの入力。送った項目だけを直す。F-307 */
export const kakeiboPatchInput = z.object({
  date: fields.date.optional(),
  amount: fields.amount.optional(),
  category: fields.category.optional(),
  memo: fields.memo.optional(),
});

export type KakeiboInput = z.infer<typeof kakeiboInput>;
export type KakeiboPatchInput = z.infer<typeof kakeiboPatchInput>;
