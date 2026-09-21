import { z } from "zod";

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
  .object({ groupId: z.string().min(1, GROUP_REQUIRED), ...fields, attendeeIds: fields.attendeeIds.default([]) })
  .refine(endsAfterStart, endsAfterStartMessage);

/** 予定を直すときの入力。送った項目だけを直す */
export const eventPatchInput = z
  .object({
    groupId: z.string().min(1, GROUP_REQUIRED).optional(),
    title: fields.title.optional(),
    allDay: fields.allDay.optional(),
    startsAt: fields.startsAt.optional(),
    endsAt: fields.endsAt.optional(),
    memo: fields.memo.optional(),
    /** 送ると、招待する人をこの顔ぶれに置き換える */
    attendeeIds: fields.attendeeIds.optional(),
  })
  .refine(endsAfterStart, endsAfterStartMessage);

/** 招待への返事。返事待ちには戻せない。#28 */
export const responseInput = z.object({
  response: z.enum(["accepted", "declined"], { error: "「参加する」か「参加しない」を選んでください。" }),
});

export type EventInput = z.infer<typeof eventInput>;
export type EventPatchInput = z.infer<typeof eventPatchInput>;
