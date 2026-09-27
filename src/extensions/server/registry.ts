/**
 * サーバー側の拡張の一覧。拡張を足すときは、ここに 1 行足す。
 * 表の定義は db/client.ts が、API は server/index.ts が、項目は calendar モジュールがここから読む。
 */
import { eventsServer } from "@extensions/events/server/index";
import { externalCalendarsServer } from "@extensions/external-calendars/server/index";
import { kakeiboServer } from "@extensions/kakeibo/server/index";
import { listsServer } from "@extensions/lists/server/index";
import { memoriesServer } from "@extensions/memories/server/index";
import { weatherServer } from "@extensions/weather/server/index";
import type { DB } from "@server/core/db/client";
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

/** すべての拡張が notify() で積む kind の一覧。`/api/notifications/unread-count` が数える範囲を絞るのに使う。#32 */
export function knownNotificationKinds(): string[] {
  return serverExtensions.flatMap((x) => x.manifest.notificationKinds ?? []);
}

/** すべての拡張が R2 に置いているものの合計バイト数。storageBytes を持たない拡張は 0 として数える。0066 */
export async function totalExtensionStorageBytes(db: DB): Promise<number> {
  const totals = await Promise.all(serverExtensions.map((x) => x.storageBytes?.(db) ?? Promise.resolve(0)));
  return totals.reduce((sum, n) => sum + n, 0);
}
