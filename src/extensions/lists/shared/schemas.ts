import { z } from "zod";
import { isDateKey } from "./dates";

const fields = {
  groupId: z.string().min(1, "グループを選んでください。"),
  /** リストの名前。F-201 */
  title: z.string().trim().min(1, "名前を入れてください。").max(50, "名前は 50 文字までです。"),
  /** `2026-09-22` の形。省くか null でカレンダーから外す。F-206、F-208 */
  date: z.string().refine(isDateKey, "日付を入れてください。").nullable(),
  /** 項目の文字。F-203 */
  text: z.string().trim().min(1, "項目を入れてください。").max(200, "項目は 200 文字までです。"),
};

/** リストを作るときの入力。F-201 */
export const listInput = z.object({
  groupId: fields.groupId,
  title: fields.title,
  date: fields.date.optional(),
});

/** リストを直すときの入力。送った項目だけを直す。F-206 */
export const listPatchInput = z.object({
  title: fields.title.optional(),
  date: fields.date.optional(),
});

/** 項目を足すときの入力。F-203 */
export const listItemInput = z.object({
  text: fields.text,
});

/** 項目のチェックを直すときの入力。F-204 */
export const listItemPatchInput = z.object({
  checked: z.boolean(),
});

export type ListInput = z.infer<typeof listInput>;
export type ListPatchInput = z.infer<typeof listPatchInput>;
export type ListItemInput = z.infer<typeof listItemInput>;
export type ListItemPatchInput = z.infer<typeof listItemPatchInput>;
