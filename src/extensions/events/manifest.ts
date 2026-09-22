import type { ExtensionManifest } from "../types";

/** 予定。最初の拡張で、いつも有効 */
export const eventsManifest: ExtensionManifest = {
  key: "events",
  label: "予定",
  description: "日付と時刻のある予定を登録する",
  alwaysOn: true,
};
