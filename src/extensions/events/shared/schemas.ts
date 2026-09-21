import { z } from "zod";

const fields = {
  title: z.string().trim().min(1, "題名を入れてください。").max(100, "題名は 100 文字までです。"),
  allDay: z.boolean(),
  /** 始まり。ミリ秒の UTC。終日なら端末の時間帯の 0 時 */
  startsAt: z.number().int(),
  /** 終わり。この時刻を含まない。終日なら終わりの日の翌日の 0 時 */
  endsAt: z.number().int().nullable(),
  memo: z.string().max(1000, "メモは 1000 文字までです。").nullable(),
};

const GROUP_REQUIRED = "予定を置くグループを選んでください。";

const endsAfterStart = (v: { startsAt?: number; endsAt?: number | null }) =>
  v.endsAt == null || v.startsAt == null || v.endsAt >= v.startsAt;
const endsAfterStartMessage = { message: "終わりは始まりより後にしてください。", path: ["endsAt"] };

/** 予定を作るときの入力 */
export const eventInput = z.object({ groupId: z.string().min(1, GROUP_REQUIRED), ...fields }).refine(endsAfterStart, endsAfterStartMessage);

/** 予定を直すときの入力。送った項目だけを直す */
export const eventPatchInput = z
  .object({
    groupId: z.string().min(1, GROUP_REQUIRED).optional(),
    title: fields.title.optional(),
    allDay: fields.allDay.optional(),
    startsAt: fields.startsAt.optional(),
    endsAt: fields.endsAt.optional(),
    memo: fields.memo.optional(),
  })
  .refine(endsAfterStart, endsAfterStartMessage);

export type EventInput = z.infer<typeof eventInput>;
export type EventPatchInput = z.infer<typeof eventPatchInput>;
