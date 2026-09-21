import { and, eq, inArray } from "drizzle-orm";
import type { CalendarItem } from "../../shared/api-types";
import type { DB } from "../db/client";
import { groupExtensions } from "../db/schema";
import { eventsProvider } from "./events";

/**
 * 拡張がカレンダーに項目を渡す口。0008 で決めた形。
 * カレンダーは拡張の中身を知らず、この一覧を順に呼ぶだけ。
 */
export type CalendarProvider = {
  key: string;
  label: string;
  description: string;
  /** 予定だけ true。切り替えの対象にしない */
  alwaysOn: boolean;
  list(db: DB, groupIds: string[], from: number, to: number): Promise<CalendarItem[]>;
};

// 拡張を足すときは、ここに 1 行足す
export const providers: CalendarProvider[] = [eventsProvider];

export function toggleableProviders(): CalendarProvider[] {
  return providers.filter((p) => !p.alwaysOn);
}

/** 期間とグループを受け取り、有効な拡張の項目をまとめて日時の順に返す */
export async function listCalendarItems(db: DB, groupIds: string[], from: number, to: number): Promise<CalendarItem[]> {
  if (groupIds.length === 0) return [];
  const toggles = toggleableProviders();
  const enabledRows = toggles.length
    ? await db
        .select()
        .from(groupExtensions)
        .where(and(inArray(groupExtensions.groupId, groupIds), eq(groupExtensions.enabled, true)))
    : [];

  const results = await Promise.all(
    providers.map((p) => {
      const ids = p.alwaysOn
        ? groupIds
        : enabledRows.filter((r) => r.extensionKey === p.key).map((r) => r.groupId);
      return ids.length ? p.list(db, ids, from, to) : Promise.resolve([]);
    }),
  );
  return results.flat().sort((a, b) => a.startsAt - b.startsAt || a.title.localeCompare(b.title, "ja"));
}
