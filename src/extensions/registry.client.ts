/**
 * 画面の側の拡張の一覧。拡張を足したら、ここに 1 行足す。
 * サーバーの側の一覧は registry.server.ts にある。
 */
import { eventsClient } from "./events/client";
import { externalCalendarsClient } from "./external-calendars/client";
import type { ClientExtension } from "./types.client";

/** 画面の側の拡張 */
export const clientExtensions: ClientExtension[] = [eventsClient, externalCalendarsClient];

/** 項目を作るときに使う拡張。いまは予定だけ */
export const defaultExtension: ClientExtension = eventsClient;

/**
 * 項目の extension に合う拡張を返す。
 * @param key CalendarItem.extension
 */
export function clientExtension(key: string): ClientExtension | undefined {
  return clientExtensions.find((x) => x.manifest.key === key);
}
