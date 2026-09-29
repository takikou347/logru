import type { NotificationKindDef } from "@shared/notifications";
import type { ExtensionManifest } from "../types";

/** 家計簿の拡張が積むお知らせの種類。0096、issue #246 */
export const KAKEIBO_NOTIFICATION_KINDS = [
  { kind: "kakeibo.expense_shared", label: "立て替えられた", defaultList: true, defaultPush: true },
  { kind: "kakeibo.settled", label: "精算したと記録された", defaultList: true, defaultPush: true },
  { kind: "kakeibo.recurring_posted", label: "定期の記録が入った", defaultList: true, defaultPush: false },
  { kind: "kakeibo.budget_exceeded", label: "予算を超えた", defaultList: true, defaultPush: false },
] as const satisfies readonly NotificationKindDef[];

/** 家計簿の拡張が notify() に渡せる kind の型 */
export type KakeiboNotificationKind = (typeof KAKEIBO_NOTIFICATION_KINDS)[number]["kind"];

/** 家計簿。口座を持ち、支出・収入・振替を記録する。ふつうの家計簿として使える形にする。0069 */
export const kakeiboManifest: ExtensionManifest = {
  key: "kakeibo",
  label: "家計簿",
  description: "支出・収入・振替を記録して、口座と総資産を見る",
  alwaysOn: false,
  notificationKinds: KAKEIBO_NOTIFICATION_KINDS,
  tour: [
    {
      target: '[aria-label="家計簿の操作"]',
      text: "「+」で支出を記録できます。口座と予算は、下の「口座」「予算」から作れます。",
    },
  ],
};
