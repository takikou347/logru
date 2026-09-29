import type { NotificationKindDef } from "@shared/notifications";
import type { ExtensionManifest } from "../types";

/** 共有リストの拡張が積むお知らせの種類。0096、issue #247 */
export const LISTS_NOTIFICATION_KINDS = [
  { kind: "lists.item_added", label: "リストに項目が足された", defaultList: true, defaultPush: false },
  { kind: "lists.item_checked", label: "リストの項目が済みになった", defaultList: true, defaultPush: false },
  { kind: "lists.all_checked", label: "リストの項目が全部済みになった", defaultList: true, defaultPush: true },
] as const satisfies readonly NotificationKindDef[];

/** 共有リストの拡張が notify() に渡せる kind の型 */
export type ListsNotificationKind = (typeof LISTS_NOTIFICATION_KINDS)[number]["kind"];

/** 共有リスト。買い物や持ち物を、グループで 1 つのリストとして持つ。最初の版は小さく作る。0054、issue #108 */
export const listsManifest: ExtensionManifest = {
  key: "lists",
  label: "リスト",
  description: "買い物や持ち物を、グループで共有するチェックリスト",
  alwaysOn: false,
  notificationKinds: LISTS_NOTIFICATION_KINDS,
  tour: [
    {
      target: '[aria-label="項目を足す"]',
      text: "上の欄に打って Enter か「足す」で項目を足せます。項目は左へスワイプすると、直す・消すができます。",
    },
  ],
};
