import { and, gt, gte, inArray, lt } from "drizzle-orm";
import type { CalendarItem } from "../../../shared/api-types";
import type { DB } from "../../../server/core/db/client";
import { DAY_MS, DEFAULT_TIME_ZONE, dayKeyIn, startOfDayIn } from "../shared/days";
import { memories, memoryRecords } from "./schema";

/** カレンダーの項目の ID の頭。思い出と、日ごとにまとめた記録を見分ける */
export const ITEM_PREFIX = { memory: "m:", records: "r:" } as const;

/**
 * カレンダーに渡す項目。0008
 *
 * - 思い出: 期間にかかるものを 1 件 1 項目で返す。終日の帯になる
 * - 記録: グループと日ごとに 1 項目にまとめる。題名は「記録 3」。日は日本時間で数える
 *
 * @param db D1 を包んだ Drizzle
 * @param groupIds 呼んでよいグループ。思い出の拡張が有効なものだけ
 * @param from 期間の始まり
 * @param to 期間の終わり。含まない
 */
export async function listMemoryItems(db: DB, groupIds: string[], from: number, to: number): Promise<CalendarItem[]> {
  const rows = await db
    .select()
    .from(memories)
    .where(and(inArray(memories.groupId, groupIds), lt(memories.startsAt, new Date(to)), gt(memories.endsAt, new Date(from))));
  const records = await db
    .select({ groupId: memoryRecords.groupId, occurredAt: memoryRecords.occurredAt })
    .from(memoryRecords)
    .where(and(inArray(memoryRecords.groupId, groupIds), gte(memoryRecords.occurredAt, new Date(from)), lt(memoryRecords.occurredAt, new Date(to))));

  const counts = new Map<string, { groupId: string; day: string; n: number }>();
  for (const r of records) {
    const day = dayKeyIn(r.occurredAt.getTime(), DEFAULT_TIME_ZONE);
    const key = `${r.groupId}:${day}`;
    const c = counts.get(key) ?? { groupId: r.groupId, day, n: 0 };
    c.n += 1;
    counts.set(key, c);
  }

  return [
    ...rows.map<CalendarItem>((m) => ({
      extension: "memories",
      id: `${ITEM_PREFIX.memory}${m.id}`,
      groupId: m.groupId,
      createdBy: m.createdBy,
      startsAt: m.startsAt.getTime(),
      endsAt: m.endsAt.getTime(),
      allDay: true,
      title: m.title,
      tag: "思い出",
      ...(m.place ? { place: m.place } : {}),
    })),
    ...[...counts.values()].map<CalendarItem>((c) => {
      const start = startOfDayIn(c.day, DEFAULT_TIME_ZONE);
      return {
        extension: "memories",
        id: `${ITEM_PREFIX.records}${c.groupId}:${c.day}`,
        groupId: c.groupId,
        createdBy: null,
        startsAt: start,
        endsAt: start + DAY_MS,
        allDay: true,
        title: `記録 ${c.n}`,
        tag: "記録",
        secondary: true,
      };
    }),
  ];
}
