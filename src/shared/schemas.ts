/**
 * 土台の API の入力の検証。画面の入力とサーバーの検証で同じものを使う。
 * 拡張の入力は src/extensions/<名前>/shared/ に置く。
 */

import { ACCENT_COLOR_KEYS, GROUP_COLOR_KEYS } from "@shared/colors";
import { z } from "zod";

/** グループの色と、自分の色の名前 */
const groupColorSchema = z.enum(GROUP_COLOR_KEYS);
/** テーマカラーの名前 */
const accentColorSchema = z.enum(ACCENT_COLOR_KEYS);

/** `PUT /api/me/settings`。F-13、F-14、F-30 */
export const settingsInput = z.object({
  themeMode: z.enum(["system", "light", "dark"]),
  bgTheme: z.enum(["glass", "flat"]),
  accentColor: accentColorSchema,
  userColor: groupColorSchema,
});

/** `PATCH /api/me`。表示名 */
export const profileInput = z.object({
  name: z.string().trim().min(1, "表示名を入れてください。").max(40, "表示名は 40 文字までです。"),
});

/** `PUT /api/me/colors/:type/:id`。自分の画面だけの色 */
export const colorPrefInput = z.object({ color: groupColorSchema });

/** `PUT /api/me/visibility/:userId`。その人の予定をカレンダーに出すか。F-20 */
export const memberVisibilityInput = z.object({ hidden: z.boolean() });

/** `POST /api/me/agreements`。最新の規約に同意する */
export const agreementsInput = z.object({ agreed: z.literal(true) });

/** `DELETE /api/me`。打ち間違いで消さないよう、決まった言葉を入れさせる */
export const deleteAccountInput = z.object({
  confirm: z.literal("削除する", { error: "確認のため「削除する」と入れてください。" }),
});

/** `POST /api/groups` */
export const groupInput = z.object({
  name: z.string().trim().min(1, "グループの名前を入れてください。").max(30, "グループの名前は 30 文字までです。"),
});

/** `PATCH /api/groups/:id`。名前と色。送った項目だけを直す */
export const groupPatchInput = z.object({
  name: groupInput.shape.name.optional(),
  color: groupColorSchema.optional(),
});

/** `PATCH /api/groups/:id/members/:userId`。管理者の受け渡し */
export const memberRoleInput = z.object({ role: z.enum(["admin", "member"]) });

/** `POST /api/me/push`。ブラウザーの PushSubscription の中身。F-23 */
export const pushSubscriptionInput = z.object({
  endpoint: z.string().url().startsWith("https://", "送り先が正しくありません。").max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
  userAgent: z.string().max(200).optional(),
});

/** `PUT /api/groups/:id/extensions/:key` */
export const extensionToggleInput = z.object({ enabled: z.boolean() });

/** カレンダーで 1 回に読める期間の上限。100 日 */
const MAX_RANGE_MS = 100 * 24 * 60 * 60 * 1000;

/** `GET /api/calendar` の問い合わせ。group はカンマで区切ったグループの ID */
export const calendarQuery = z
  .object({
    from: z.coerce.number().int(),
    to: z.coerce.number().int(),
    group: z.string().optional(),
  })
  .refine((v) => v.to > v.from && v.to - v.from <= MAX_RANGE_MS, { message: "期間が正しくありません。" });

export type SettingsInput = z.infer<typeof settingsInput>;
