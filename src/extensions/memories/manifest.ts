import type { NotificationKindDef } from "@shared/notifications";
import type { ExtensionManifest } from "../types";

/** 思い出の拡張が積むお知らせの種類。0096、F-116、issue #244、#247 */
export const MEMORIES_NOTIFICATION_KINDS = [
  { kind: "memories.like", label: "記録にいいねが付いた", defaultList: true, defaultPush: false },
  { kind: "memories.koma_slot", label: "ひとコマの時刻になった", defaultList: true, defaultPush: true },
  { kind: "memories.record_added", label: "思い出に記録・写真が足された", defaultList: true, defaultPush: false },
  { kind: "memories.shiori_assigned", label: "しおりの担当になった", defaultList: true, defaultPush: true },
] as const satisfies readonly NotificationKindDef[];

/** 思い出の拡張が notify() に渡せる kind の型 */
export type MemoriesNotificationKind = (typeof MEMORIES_NOTIFICATION_KINDS)[number]["kind"];

/** 思い出。旅行やお出かけのしおりと記録と写真。グループごとに切り替える。docs/logru/extensions/memories */
export const memoriesManifest: ExtensionManifest = {
  key: "memories",
  label: "思い出",
  description: "旅行やお出かけのしおりと、写真の記録をまとめる。ふとした出来事も、その日に残せる。",
  alwaysOn: false,
  notificationKinds: MEMORIES_NOTIFICATION_KINDS,
  tour: [
    {
      target: '[aria-label="思い出の操作"]',
      text: "旅行の前に「思い出を作る」で、しおりを作れます。日々のことは「記録する」から写真と一言で残せます。",
    },
  ],
};
