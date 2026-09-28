/**
 * サーバー側の拡張の一覧。拡張を足すときは、ここに 1 行足す。
 * 表の定義は db/client.ts が、API は server/index.ts が、項目は calendar モジュールがここから読む。
 */
import type { EventsNotificationKind } from "@extensions/events/manifest";
import { eventsServer } from "@extensions/events/server/index";
import { externalCalendarsServer } from "@extensions/external-calendars/server/index";
import type { KakeiboNotificationKind } from "@extensions/kakeibo/manifest";
import { kakeiboServer } from "@extensions/kakeibo/server/index";
import type { ListsNotificationKind } from "@extensions/lists/manifest";
import { listsServer } from "@extensions/lists/server/index";
import type { MemoriesNotificationKind } from "@extensions/memories/manifest";
import { memoriesServer } from "@extensions/memories/server/index";
import { weatherServer } from "@extensions/weather/server/index";
import type { DB } from "@server/core/db/client";
import { CORE_NOTIFICATION_KINDS, type CoreNotificationKind, type NotificationKindDef } from "@shared/notifications";
import type { ServerExtension } from "./types";

/** すべての拡張。並びはカレンダーの項目の並びに影響しない */
export const serverExtensions: ServerExtension[] = [
  eventsServer,
  externalCalendarsServer,
  memoriesServer,
  kakeiboServer,
  listsServer,
  weatherServer,
];

/** すべての拡張の表の定義。db/client.ts が Drizzle に渡す */
export const extensionSchemas = Object.assign({}, ...serverExtensions.map((x) => x.schema)) as Record<string, unknown>;

/** 切り替えられる拡張。いつも有効な予定と、利用者ごとの拡張は含めない */
export function toggleableExtensions(): ServerExtension[] {
  return serverExtensions.filter((x) => !x.manifest.alwaysOn && !x.manifest.perUser);
}

/**
 * notify() の kind に渡せる文字列の型。土台(groups.*)と、すべての拡張の manifest から集める。0096、F-47
 * ここに無い文字列は notify() に渡せない。拡張を足すときは、この Union にも 1 行足す
 */
export type KnownNotificationKind =
  | CoreNotificationKind
  | EventsNotificationKind
  | MemoriesNotificationKind
  | KakeiboNotificationKind
  | ListsNotificationKind;

/** 土台とすべての拡張の、お知らせの種類の定義。設定の「お知らせ」の行と、既定の値に使う。0096 */
export function allNotificationKindDefs(): NotificationKindDef[] {
  return [...CORE_NOTIFICATION_KINDS, ...serverExtensions.flatMap((x) => x.manifest.notificationKinds ?? [])];
}

/** すべての拡張が notify() で積む kind の一覧。`/api/notifications/unread-count` が数える範囲を絞るのに使う。#32 */
export function knownNotificationKinds(): string[] {
  return allNotificationKindDefs().map((d) => d.kind);
}

/** その kind の、一覧に出すか・端末にも知らせるかの既定。知らない kind は両方 false にする。0096 */
export function notificationKindDefaults(kind: string): { list: boolean; push: boolean } {
  const def = allNotificationKindDefs().find((d) => d.kind === kind);
  return { list: def?.defaultList ?? false, push: def?.defaultPush ?? false };
}

/** すべての拡張が R2 に置いているものの合計バイト数。storageBytes を持たない拡張は 0 として数える。0066 */
export async function totalExtensionStorageBytes(db: DB): Promise<number> {
  const totals = await Promise.all(serverExtensions.map((x) => x.storageBytes?.(db) ?? Promise.resolve(0)));
  return totals.reduce((sum, n) => sum + n, 0);
}
