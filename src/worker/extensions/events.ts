import { and, gte, inArray, isNull, lt, or } from "drizzle-orm";
import type { CalendarItem } from "../../shared/api-types";
import type { DB } from "../db/client";
import { events } from "../db/schema";
import type { CalendarProvider } from "./registry";

/** 予定。最初の拡張であり、いつも有効 */
export const eventsProvider: CalendarProvider = {
  key: "events",
  label: "予定",
  description: "日付と時刻のある予定を登録する",
  alwaysOn: true,
  async list(db: DB, groupIds: string[], from: number, to: number): Promise<CalendarItem[]> {
    const rows = await db
      .select()
      .from(events)
      .where(
        and(
          inArray(events.groupId, groupIds),
          lt(events.startsAt, new Date(to)),
          // 終わりが期間に入るか、終わりが無く始まりが期間に入るもの
          or(gte(events.endsAt, new Date(from)), and(isNull(events.endsAt), gte(events.startsAt, new Date(from)))),
        ),
      );
    return rows.map((r) => ({
      extension: "events",
      id: r.id,
      groupId: r.groupId,
      createdBy: r.createdBy,
      startsAt: r.startsAt.getTime(),
      endsAt: r.endsAt?.getTime() ?? null,
      allDay: r.allDay,
      title: r.title,
      memo: r.memo,
    }));
  },
};
