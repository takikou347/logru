/**
 * 画面の側の拡張の一覧。拡張を足したら、ここに 1 行足す。
 * サーバーの側の一覧は registry.server.ts にある。
 */
import { eventsClient } from "@extensions/events/client/index";
import { externalCalendarsClient } from "@extensions/external-calendars/client/index";
import { memoriesClient } from "@extensions/memories/client/index";
import type { ClientExtension } from "./types";

/** 画面の側の拡張 */
export const clientExtensions: ClientExtension[] = [eventsClient, externalCalendarsClient, memoriesClient];

/** 項目を作るときに使う拡張。いまは予定だけ */
export const defaultExtension: ClientExtension = eventsClient;

/**
 * 項目の extension に合う拡張を返す。
 * @param key CalendarItem.extension
 */
export function clientExtension(key: string): ClientExtension | undefined {
  return clientExtensions.find((x) => x.manifest.key === key);
}
