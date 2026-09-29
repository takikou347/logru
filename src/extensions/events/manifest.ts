import type { NotificationKindDef } from "@shared/notifications";
import type { ExtensionManifest } from "../types";

/** 予定の拡張が積むお知らせの種類。0096、issue #244、#245 */
export const EVENTS_NOTIFICATION_KINDS = [
  { kind: "events.invite_accepted", label: "予定の招待に返事があった", defaultList: true, defaultPush: true },
  { kind: "events.event_added", label: "共有の予定が足された", defaultList: true, defaultPush: false },
  { kind: "events.event_updated", label: "共有の予定が変わった", defaultList: true, defaultPush: false },
  { kind: "events.event_deleted", label: "共有の予定が消された", defaultList: true, defaultPush: false },
] as const satisfies readonly NotificationKindDef[];

/** 予定の拡張が notify() に渡せる kind の型 */
export type EventsNotificationKind = (typeof EVENTS_NOTIFICATION_KINDS)[number]["kind"];

/** 予定。最初の拡張で、いつも有効 */
export const eventsManifest: ExtensionManifest = {
  key: "events",
  label: "予定",
  description: "日付と時刻のある予定を登録する",
  alwaysOn: true,
  notificationKinds: EVENTS_NOTIFICATION_KINDS,
};
