import { z } from "zod";
import { ACCENT_COLOR_KEYS, GROUP_COLOR_KEYS } from "./colors";

export const groupColorSchema = z.enum(GROUP_COLOR_KEYS);
export const accentColorSchema = z.enum(ACCENT_COLOR_KEYS);

export const settingsInput = z.object({
  themeMode: z.enum(["system", "light", "dark"]),
  accentColor: accentColorSchema,
  userColor: groupColorSchema,
});

export const profileInput = z.object({
  name: z.string().trim().min(1, "表示名を入れてください。").max(40, "表示名は 40 文字までです。"),
});

export const colorPrefInput = z.object({ color: groupColorSchema });

export const agreementsInput = z.object({ agreed: z.literal(true) });

export const deleteAccountInput = z.object({
  confirm: z.literal("削除する", { error: "確認のため「削除する」と入れてください。" }),
});

export const groupInput = z.object({
  name: z.string().trim().min(1, "グループの名前を入れてください。").max(30, "グループの名前は 30 文字までです。"),
});

export const groupPatchInput = z.object({
  name: groupInput.shape.name.optional(),
  color: groupColorSchema.optional(),
});

export const memberRoleInput = z.object({ role: z.enum(["admin", "member"]) });

export const extensionToggleInput = z.object({ enabled: z.boolean() });

const eventFields = {
  title: z.string().trim().min(1, "題名を入れてください。").max(100, "題名は 100 文字までです。"),
  allDay: z.boolean(),
  startsAt: z.number().int(),
  endsAt: z.number().int().nullable(),
  memo: z.string().max(1000, "メモは 1000 文字までです。").nullable(),
};

const endsAfterStart = (v: { startsAt?: number; endsAt?: number | null }) =>
  v.endsAt == null || v.startsAt == null || v.endsAt >= v.startsAt;
const endsAfterStartMessage = { message: "終わりは始まりより後にしてください。", path: ["endsAt"] };

export const eventInput = z
  .object({ groupId: z.string().min(1), ...eventFields })
  .refine(endsAfterStart, endsAfterStartMessage);

export const eventPatchInput = z
  .object({
    groupId: z.string().min(1).optional(),
    title: eventFields.title.optional(),
    allDay: eventFields.allDay.optional(),
    startsAt: eventFields.startsAt.optional(),
    endsAt: eventFields.endsAt.optional(),
    memo: eventFields.memo.optional(),
  })
  .refine(endsAfterStart, endsAfterStartMessage);

export const MAX_RANGE_MS = 100 * 24 * 60 * 60 * 1000;

export const calendarQuery = z
  .object({
    from: z.coerce.number().int(),
    to: z.coerce.number().int(),
    group: z.string().optional(),
  })
  .refine((v) => v.to > v.from && v.to - v.from <= MAX_RANGE_MS, { message: "期間が正しくありません。" });

export type SettingsInput = z.infer<typeof settingsInput>;
export type EventInput = z.infer<typeof eventInput>;
