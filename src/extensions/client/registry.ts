/**
 * 画面の側の拡張の一覧。拡張を足したら、ここに 1 行足す。
 * サーバーの側の一覧は registry.server.ts にある。
 */
import { eventsClient } from "@extensions/events/client/index";
import { externalCalendarsClient } from "@extensions/external-calendars/client/index";
import { kakeiboClient } from "@extensions/kakeibo/client/index";
import { listsClient } from "@extensions/lists/client/index";
import { memoriesClient } from "@extensions/memories/client/index";
import { weatherClient } from "@extensions/weather/client/index";
import { CORE_NOTIFICATION_KINDS, type NotificationKindDef } from "@shared/notifications";
import type { ClientExtension } from "./types";

/** 画面の側の拡張 */
export const clientExtensions: ClientExtension[] = [
  eventsClient,
  externalCalendarsClient,
  memoriesClient,
  kakeiboClient,
  listsClient,
  weatherClient,
];

/** 項目を作るときに使う拡張。いまは予定だけ */
export const defaultExtension: ClientExtension = eventsClient;

/**
 * 項目の extension に合う拡張を返す。
 * @param key CalendarItem.extension
 */
export function clientExtension(key: string): ClientExtension | undefined {
  return clientExtensions.find((x) => x.manifest.key === key);
}

/**
 * 設定の「お知らせ」に出す、機能ごとの種類の一覧。「グループ」(土台の groups.* )を先頭に、
 * 種類を持つ拡張が続く。0096、F-47
 */
export function notificationKindGroups(): { key: string; label: string; kinds: NotificationKindDef[] }[] {
  const groups: { key: string; label: string; kinds: NotificationKindDef[] }[] = [
    { key: "groups", label: "グループ", kinds: [...CORE_NOTIFICATION_KINDS] },
  ];
  for (const x of clientExtensions) {
    if (x.manifest.notificationKinds?.length) {
      groups.push({ key: x.manifest.key, label: x.manifest.label, kinds: [...x.manifest.notificationKinds] });
    }
  }
  return groups;
}
