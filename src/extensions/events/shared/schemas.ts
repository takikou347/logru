import { z } from "zod";

/** 繰り返しの周期。0043 */
const REPEAT_FREQS = ["daily", "weekly", "monthly", "yearly"] as const;

/** 繰り返す予定を直す、消すときの範囲。この回だけ・これ以降・全部。画面の側は ItemEditScope。0043 */
const EDIT_SCOPES = ["this", "following", "all"] as const;

/** 繰り返しの規則。freq が無ければ繰り返さない。0043 */
export const repeatRuleInput = z
  .object({
    freq: z.enum(REPEAT_FREQS),
    /** weekly だけで使う。月を 1、日を 7 とした数 */
    daysOfWeek: z.array(z.number().int().min(1).max(7)).min(1).max(7).optional(),
    until: z.number().int().optional(),
    count: z.number().int().min(1, "回数は 1 以上にしてください。").max(999, "回数は 999 までです。").optional(),
  })
  .refine((v) => v.until == null || v.count == null, {
    message: "終わりは、日付か回数のどちらかにしてください。",
    path: ["count"],
  });

/** 予定の入力に足す、繰り返しの欄。null なら繰り返さない */
const repeatField = repeatRuleInput.nullable();

const fields = {
  title: z.string().trim().min(1, "題名を入れてください。").max(100, "題名は 100 文字までです。"),
  allDay: z.boolean(),
  /** 始まり。ミリ秒の UTC。終日なら端末の時間帯の 0 時 */
  startsAt: z.number().int(),
  /** 終わり。この時刻を含まない。終日なら終わりの日の翌日の 0 時 */
  endsAt: z.number().int().nullable(),
  memo: z.string().max(1000, "メモは 1000 文字までです。").nullable(),
  /** 招待する人の ID。作った人は含めなくてよい。予定のグループのメンバーだけ。#28 */
  attendeeIds: z.array(z.string().min(1)).max(100, "招待できるのは 100 人までです。"),
};

const GROUP_REQUIRED = "予定を置くグループを選んでください。";

const endsAfterStart = (v: { startsAt?: number; endsAt?: number | null }) =>
  v.endsAt == null || v.startsAt == null || v.endsAt >= v.startsAt;
const endsAfterStartMessage = { message: "終わりは始まりより後にしてください。", path: ["endsAt"] };

/** 予定を作るときの入力 */
export const eventInput = z
  .object({
    groupId: z.string().min(1, GROUP_REQUIRED),
    ...fields,
    attendeeIds: fields.attendeeIds.default([]),
    /** 繰り返しの規則。省くか null なら繰り返さない。0043 */
    repeat: repeatField.optional(),
  })
  .refine(endsAfterStart, endsAfterStartMessage);

/**
 * 予定を直すときの入力。送った項目だけを直す。0043
 *
 * 繰り返す予定では scope が要る。this は occurrenceAt の回だけ、following はその回から新しい予定に分け、
 * all はいまの予定をそのまま直す。繰り返さない予定では両方とも省ける。
 */
export const eventPatchInput = z
  .object({
    groupId: z.string().min(1, GROUP_REQUIRED).optional(),
    title: fields.title.optional(),
    allDay: fields.allDay.optional(),
    startsAt: fields.startsAt.optional(),
    endsAt: fields.endsAt.optional(),
    memo: fields.memo.optional(),
    /** 送ると、招待する人をこの顔ぶれに置き換える。this の範囲では無視する */
    attendeeIds: fields.attendeeIds.optional(),
    /** 繰り返しの規則。this の範囲では無視する */
    repeat: repeatField.optional(),
    /** 直す回。規則どおりの始まりの時刻 */
    occurrenceAt: z.number().int().optional(),
    scope: z.enum(EDIT_SCOPES).optional(),
  })
  .refine(endsAfterStart, endsAfterStartMessage);

/** 予定を消すときの入力。繰り返す予定では scope が要る。0043 */
export const eventDeleteInput = z.object({
  occurrenceAt: z.number().int().optional(),
  scope: z.enum(EDIT_SCOPES).optional(),
});

/** 招待への返事。返事待ちには戻せない。#28 */
export const responseInput = z.object({
  response: z.enum(["accepted", "declined"], { error: "「参加する」か「参加しない」を選んでください。" }),
});

export type EventInput = z.infer<typeof eventInput>;
export type EventPatchInput = z.infer<typeof eventPatchInput>;
export type EventDeleteInput = z.infer<typeof eventDeleteInput>;
export type RepeatRuleInput = z.infer<typeof repeatRuleInput>;
