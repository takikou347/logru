/**
 * 土台の API の入力の検証。画面の入力とサーバーの検証で同じものを使う。
 * 拡張の入力は src/extensions/<名前>/shared/ に置く。
 */

import { ACCENT_COLOR_KEYS, GROUP_COLOR_KEYS } from "@shared/colors";
import { isValidHomeLayout } from "@shared/home";
import { TOUR_ID_PATTERN } from "@shared/tours";
import { z } from "zod";

/** グループの色と、自分の色の名前 */
const groupColorSchema = z.enum(GROUP_COLOR_KEYS);
/** テーマカラーの名前 */
const accentColorSchema = z.enum(ACCENT_COLOR_KEYS);

/**
 * `PUT /api/me/settings`。F-13、F-14、F-30
 * bgTheme は任意。PWA の古い画面は Service Worker が新しくなるまで送ってこないことがあるが、
 * drizzle は undefined の項目を `set` に入れないので、送らなければ保存してある値がそのまま残る。#63
 */
export const settingsInput = z.object({
  themeMode: z.enum(["system", "light", "dark"]),
  bgTheme: z.enum(["glass", "flat"]).optional(),
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

/** `PUT /api/me/tours/:id` の id。案内を見た画面。F-33 */
export const tourIdParam = z.object({ id: z.string().max(60).regex(TOUR_ID_PATTERN) });

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

/** `GET /api/me/home-layout` の問い合わせ。0029 */
export const homeLayoutQuery = z.object({ form: z.enum(["desktop", "mobile"]) });

/** `GET /api/search` の問い合わせ。前後の空白を除いて 1 文字から 100 文字。0046 */
export const searchQuery = z.object({ q: z.string().trim().min(1).max(100) });

/** `PUT /api/me/home-layout`。並びに同じ key を 2 つ許さず、カレンダーの本体を必ず含む。0029 */
export const homeLayoutInput = z
  .object({
    form: z.enum(["desktop", "mobile"]),
    widgets: z
      // 前の画面が送ってくる size は、z.object が捨てる。0037
      .array(z.object({ key: z.string().min(1).max(80) }))
      .min(1)
      .max(60),
  })
  .refine((v) => isValidHomeLayout(v.widgets), { message: "並びが正しくありません。" });

/**
 * `POST /api/client-errors`。画面で起きた誤りの短い報告。ログイン前にも送るので、ログインは求めない。
 * 予定の中身や名前は送らない。本文の大きさは hono/body-limit で別に絞る。0040
 */
export const clientErrorInput = z.object({
  path: z.string().min(1).max(300),
  message: z.string().min(1).max(1000),
  stack: z.string().max(4000).optional(),
  buildVersion: z.string().min(1).max(100),
});
