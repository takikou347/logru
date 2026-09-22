import { z } from "zod";
import { MAX_MEMORY_DAYS } from "./days";

const title = z.string().trim().min(1, "題名を入れてください。").max(60, "題名は 60 文字までです。");
const place = z.string().trim().max(60, "場所は 60 文字までです。").nullable();
const timeZone = z.string().min(1).max(64).refine(
  (tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: "時間帯が正しくありません。" },
);
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません。");

/** 期間の日数が 1 日から 31 日までか。F-101 */
const rangeOk = (v: { firstDay?: string; lastDay?: string }) => {
  if (!v.firstDay || !v.lastDay) return true;
  const days = (Date.parse(v.lastDay) - Date.parse(v.firstDay)) / 86_400_000 + 1;
  return days >= 1 && days <= MAX_MEMORY_DAYS;
};
const rangeMessage = { message: `期間は 1 日から ${MAX_MEMORY_DAYS} 日までです。終わりは始まりより後にしてください。`, path: ["lastDay"] };

/** `POST /api/memories`。期間は日付で受け、サーバーが時間帯で 0 時に直す */
export const memoryInput = z
  .object({
    groupId: z.string().min(1, "共有するグループを選んでください。"),
    title,
    place: place.default(null),
    firstDay: dateKey,
    lastDay: dateKey,
    timeZone,
    komaEnabled: z.boolean().default(false),
  })
  .refine(rangeOk, rangeMessage);

/** `PATCH /api/memories/:id`。送った項目だけを直す */
export const memoryPatchInput = z
  .object({
    title: title.optional(),
    place: place.optional(),
    firstDay: dateKey.optional(),
    lastDay: dateKey.optional(),
    timeZone: timeZone.optional(),
    komaEnabled: z.boolean().optional(),
    coverPhotoId: z.string().min(1).nullable().optional(),
  })
  .refine(rangeOk, rangeMessage);

/** `POST /api/memories/:id/items` */
export const itemInput = z.object({
  kind: z.enum(["wish", "todo", "packing"]),
  title: z.string().trim().min(1, "中身を入れてください。").max(80, "80 文字までです。"),
  place: place.default(null),
  dayIndex: z.number().int().min(0).max(MAX_MEMORY_DAYS - 1).nullable().default(null),
  assigneeId: z.string().min(1).nullable().default(null),
  dueOn: dateKey.nullable().default(null),
});

/** `PATCH /api/memories/:id/items/:itemId` */
export const itemPatchInput = z.object({
  title: itemInput.shape.title.optional(),
  place: place.optional(),
  dayIndex: z.number().int().min(0).max(MAX_MEMORY_DAYS - 1).nullable().optional(),
  assigneeId: z.string().min(1).nullable().optional(),
  dueOn: dateKey.nullable().optional(),
  sortOrder: z.number().int().optional(),
  done: z.boolean().optional(),
});

/** `POST /api/memories/:id/items/copy`。前の思い出の持ち物を写す。F-105 */
export const itemCopyInput = z.object({ fromMemoryId: z.string().min(1) });

const body = z.string().trim().max(1000, "文章は 1000 文字までです。").nullable();
const photoIds = z.array(z.string().min(1)).max(10, "写真は 1 回に 10 枚までです。");

/** `POST /api/memories/records`。文章か写真のどちらかが要る。F-111 */
export const recordInput = z
  .object({
    groupId: z.string().min(1, "共有するグループを選んでください。"),
    body: body.default(null),
    occurredAt: z.number().int().optional(),
    photoIds: photoIds.default([]),
    itemId: z.string().min(1).nullable().default(null),
  })
  .refine((v) => (v.body && v.body.length > 0) || v.photoIds.length > 0, { message: "文章か写真を入れてください。", path: ["body"] });

/** `PATCH /api/memories/records/:recordId` */
export const recordPatchInput = z.object({
  body: body.optional(),
  occurredAt: z.number().int().optional(),
  photoIds: photoIds.optional(),
});

/** `GET /api/memories/records` の問い合わせ。期間は 31 日まで */
export const recordsQuery = z
  .object({
    group: z.string().optional(),
    from: z.coerce.number().int(),
    to: z.coerce.number().int(),
  })
  .refine((v) => v.to > v.from && v.to - v.from <= (MAX_MEMORY_DAYS + 1) * 86_400_000, { message: "期間が正しくありません。" });

/** 写真の大きさの上限。0021 */
export const PHOTO_LIMITS = { fullBytes: 3 * 1024 * 1024, thumbBytes: 200 * 1024, tinyChars: 4096, perGroup: 3000 } as const;

export type MemoryInput = z.infer<typeof memoryInput>;
export type ItemInput = z.infer<typeof itemInput>;

/** `PUT /api/memories/koma/days/:day`。始める、止める、つなぎ直す。0022 */
export const komaDayInput = z.object({
  groupId: z.string().min(1, "グループを選んでください。"),
  memoryId: z.string().min(1).nullable().default(null),
  timeZone,
  muted: z.boolean().optional(),
});

/** `PUT /api/memories/koma`。写真は先に送っておく */
export const komaInput = z.object({
  photoId: z.string().min(1, "写真を撮ってください。"),
  slot: z.number().int(),
  body: z.string().trim().max(40, "一言は 40 文字までです。").nullable().default(null),
});
