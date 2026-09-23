import type { DB } from "@server/core/db/client";
import type { CalendarItem } from "@shared/api-types";
import { and, asc, gt, gte, inArray, like, lt, or } from "drizzle-orm";
import { DAY_MS, DEFAULT_TIME_ZONE, dayKeyIn, startOfDayIn } from "../shared/days";
import { type MemoryRow, memories, memoryPhotos, memoryRecords } from "./schema";

/** カレンダーの項目の ID の頭。思い出、日ごとの記録、日ごとのひとコマを見分ける。ひとコマも MemoryItemSheet の recordsDay の解決に使う */
const ITEM_PREFIX = { memory: "m:", records: "r:", koma: "k:" } as const;

/** 思い出の 1 行を、カレンダーの項目の形にする。期間にかかるものは終日の帯として出す */
function toCalendarItem(m: MemoryRow): CalendarItem {
  return {
    extension: "memories",
    id: `${ITEM_PREFIX.memory}${m.id}`,
    groupId: m.groupId,
    createdBy: m.createdBy,
    startsAt: m.startsAt.getTime(),
    endsAt: m.endsAt.getTime(),
    allDay: true,
    title: m.title,
    tag: "思い出",
    kind: "record",
    ...(m.place ? { place: m.place } : {}),
  };
}

/**
 * カレンダーに渡す項目。0008
 *
 * - 思い出: 期間にかかるものを 1 件 1 項目で返す。終日の帯になる
 * - 記録、ひとコマ: グループと日と kind(note、koma)ごとに 1 項目にまとめる。題名は「記録 3」「ひとコマ 3」。
 *   日は日本時間で数える。種類を見分けるアイコンを付ける。0056
 *
 * ひとコマの項目には、その日でいちばん遅い時刻の記録が持つ写真の small(無ければ tiny)を thumb として乗せる。
 * 1 年をらせんで見る画面が使う。0051、0056、#158
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
    .where(
      and(
        inArray(memories.groupId, groupIds),
        lt(memories.startsAt, new Date(to)),
        gt(memories.endsAt, new Date(from)),
      ),
    );
  const records = await db
    .select({
      id: memoryRecords.id,
      groupId: memoryRecords.groupId,
      occurredAt: memoryRecords.occurredAt,
      kind: memoryRecords.kind,
    })
    .from(memoryRecords)
    .where(
      and(
        inArray(memoryRecords.groupId, groupIds),
        gte(memoryRecords.occurredAt, new Date(from)),
        lt(memoryRecords.occurredAt, new Date(to)),
      ),
    );

  const counts = new Map<string, { groupId: string; day: string; kind: "note" | "koma"; n: number }>();
  // 日ごとの、いちばん遅い時刻のひとコマの記録を覚えておく。thumb に使う写真を 1 枚だけ選ぶため
  const latestKoma = new Map<string, { recordId: string; occurredAt: number }>();
  for (const r of records) {
    const day = dayKeyIn(r.occurredAt.getTime(), DEFAULT_TIME_ZONE);
    const key = `${r.groupId}:${day}:${r.kind}`;
    const c = counts.get(key) ?? { groupId: r.groupId, day, kind: r.kind, n: 0 };
    c.n += 1;
    counts.set(key, c);
    if (r.kind === "koma") {
      const ms = r.occurredAt.getTime();
      const current = latestKoma.get(key);
      if (!current || ms > current.occurredAt) latestKoma.set(key, { recordId: r.id, occurredAt: ms });
    }
  }

  const komaRecordIds = [...latestKoma.values()].map((v) => v.recordId);
  const thumbByRecordId = new Map<string, string>();
  if (komaRecordIds.length > 0) {
    const photos = await db
      .select({ recordId: memoryPhotos.recordId, tiny: memoryPhotos.tiny, small: memoryPhotos.small })
      .from(memoryPhotos)
      .where(inArray(memoryPhotos.recordId, komaRecordIds))
      .orderBy(asc(memoryPhotos.sortOrder));
    for (const p of photos) {
      if (p.recordId && !thumbByRecordId.has(p.recordId)) thumbByRecordId.set(p.recordId, p.small ?? p.tiny);
    }
  }

  return [
    ...rows.map(toCalendarItem),
    ...[...counts.values()].map<CalendarItem>((c) => {
      const start = startOfDayIn(c.day, DEFAULT_TIME_ZONE);
      const isKoma = c.kind === "koma";
      // thumb は、ひとコマの項目にだけ乗せる。記録(note)の項目は koma の写真を持たない
      const komaRecordId = isKoma ? latestKoma.get(`${c.groupId}:${c.day}:${c.kind}`)?.recordId : undefined;
      const thumb = komaRecordId ? thumbByRecordId.get(komaRecordId) : undefined;
      return {
        extension: "memories",
        id: `${isKoma ? ITEM_PREFIX.koma : ITEM_PREFIX.records}${c.groupId}:${c.day}`,
        groupId: c.groupId,
        createdBy: null,
        startsAt: start,
        endsAt: start + DAY_MS,
        allDay: true,
        title: isKoma ? `ひとコマ ${c.n}` : `記録 ${c.n}`,
        tag: isKoma ? "ひとコマ" : "記録",
        kind: "record",
        icon: isKoma ? "timer" : "camera",
        secondary: true,
        ...(thumb ? { thumb } : {}),
      };
    }),
  ];
}

/**
 * 思い出の題名と場所を探す。0046
 * しおりや記録の中身は対象にしない。まとまった 1 冊としての思い出だけを探す
 * @param db D1 を包んだ Drizzle
 * @param groupIds 呼んでよいグループ
 * @param query 探す文字列
 */
export async function searchMemories(db: DB, groupIds: string[], query: string): Promise<CalendarItem[]> {
  const pattern = `%${query}%`;
  const rows = await db
    .select()
    .from(memories)
    .where(and(inArray(memories.groupId, groupIds), or(like(memories.title, pattern), like(memories.place, pattern))));
  return rows.map(toCalendarItem);
}
