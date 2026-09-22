/** 思い出と記録を、画面に返す形に読む */
import { and, asc, count, desc, eq, gte, inArray, lt } from "drizzle-orm";
import type { DB } from "../../../server/core/db/client";
import type { Memory, MemoryItem, MemoryRecord } from "../shared/types";
import type { PhotoSigner } from "./photos";
import { type MemoryItemRow, type MemoryRow, memoryEventExclusions, memoryLikes, memoryPhotos, memoryRecords } from "./schema";

/** D1 は 1 つの問い合わせに渡せる値の数に上限がある。ID はこの数ずつ渡す */
const CHUNK = 90;

/**
 * 記録の行に、写真といいねを付ける。
 * @param db D1 を包んだ Drizzle
 * @param signer 写真の URL を作るもの
 * @param rows 記録の行
 */
export async function withPhotos(db: DB, signer: PhotoSigner, rows: (typeof memoryRecords.$inferSelect)[]): Promise<MemoryRecord[]> {
  const ids = rows.map((r) => r.id);
  const photos: (typeof memoryPhotos.$inferSelect)[] = [];
  const likes: { recordId: string; userId: string }[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK);
    photos.push(...(await db.select().from(memoryPhotos).where(inArray(memoryPhotos.recordId, part)).orderBy(asc(memoryPhotos.sortOrder))));
    likes.push(
      ...(await db
        .select({ recordId: memoryLikes.recordId, userId: memoryLikes.userId })
        .from(memoryLikes)
        .where(inArray(memoryLikes.recordId, part))
        .orderBy(asc(memoryLikes.createdAt))),
    );
  }
  const signed = new Map(await Promise.all(photos.map(async (p) => [p.id, await signer.photo(p)] as const)));
  return rows.map((r) => ({
    id: r.id,
    groupId: r.groupId,
    createdBy: r.createdBy,
    kind: r.kind,
    body: r.body,
    occurredAt: r.occurredAt.getTime(),
    komaSlot: r.komaSlot?.getTime() ?? null,
    itemId: r.itemId,
    photos: photos.filter((p) => p.recordId === r.id).map((p) => signed.get(p.id)!),
    likes: likes.filter((l) => l.recordId === r.id).map((l) => l.userId),
  }));
}

/**
 * 期間とグループの記録を、時刻の順に読む。
 * @param db D1 を包んだ Drizzle
 * @param signer 写真の URL を作るもの
 * @param groupIds 読んでよいグループ
 * @param from 期間の始まり
 * @param to 期間の終わり。含まない
 */
export async function loadRecords(db: DB, signer: PhotoSigner, groupIds: string[], from: number, to: number): Promise<MemoryRecord[]> {
  if (groupIds.length === 0) return [];
  const rows = await db
    .select()
    .from(memoryRecords)
    .where(
      and(inArray(memoryRecords.groupId, groupIds), gte(memoryRecords.occurredAt, new Date(from)), lt(memoryRecords.occurredAt, new Date(to))),
    )
    .orderBy(asc(memoryRecords.occurredAt));
  return withPhotos(db, signer, rows);
}

/**
 * 1 件の記録を読む。無ければ undefined。
 * @param db D1 を包んだ Drizzle
 * @param signer 写真の URL を作るもの
 * @param id 記録の ID
 */
export async function loadRecord(db: DB, signer: PhotoSigner, id: string): Promise<MemoryRecord | undefined> {
  const row = await db.select().from(memoryRecords).where(eq(memoryRecords.id, id)).get();
  return row ? (await withPhotos(db, signer, [row]))[0] : undefined;
}

/**
 * 最近の記録。思い出の外の日も含む。F-102
 * @param limit 返す数
 */
export async function recentRecords(db: DB, signer: PhotoSigner, groupIds: string[], limit = 6): Promise<MemoryRecord[]> {
  if (groupIds.length === 0) return [];
  const rows = await db
    .select()
    .from(memoryRecords)
    .where(inArray(memoryRecords.groupId, groupIds))
    .orderBy(desc(memoryRecords.occurredAt))
    .limit(limit);
  return withPhotos(db, signer, rows);
}

/**
 * 思い出の行を、表紙と写真の枚数を付けて返す形にする。
 * 表紙は選んだ写真。無いか消えていれば、期間の最初の写真。F-108
 * @param db D1 を包んだ Drizzle
 * @param signer 写真の URL を作るもの
 * @param row 思い出の行
 */
export async function toMemory(db: DB, signer: PhotoSigner, row: MemoryRow): Promise<Memory> {
  const inPeriod = and(
    eq(memoryRecords.groupId, row.groupId),
    gte(memoryRecords.occurredAt, row.startsAt),
    lt(memoryRecords.occurredAt, row.endsAt),
  );
  const chosen = row.coverPhotoId
    ? await db
        .select()
        .from(memoryPhotos)
        .where(and(eq(memoryPhotos.id, row.coverPhotoId), eq(memoryPhotos.groupId, row.groupId)))
        .get()
    : undefined;
  const first = chosen
    ? undefined
    : await db
        .select({ photo: memoryPhotos })
        .from(memoryPhotos)
        .innerJoin(memoryRecords, eq(memoryRecords.id, memoryPhotos.recordId))
        .where(inPeriod)
        .orderBy(asc(memoryRecords.occurredAt), asc(memoryPhotos.sortOrder))
        .limit(1)
        .get();
  const total = await db
    .select({ n: count() })
    .from(memoryPhotos)
    .innerJoin(memoryRecords, eq(memoryRecords.id, memoryPhotos.recordId))
    .where(inPeriod)
    .get();
  const cover = chosen ?? first?.photo;
  const excluded = await db.select({ id: memoryEventExclusions.eventId }).from(memoryEventExclusions).where(eq(memoryEventExclusions.memoryId, row.id));
  return {
    id: row.id,
    groupId: row.groupId,
    createdBy: row.createdBy,
    title: row.title,
    place: row.place,
    startsAt: row.startsAt.getTime(),
    endsAt: row.endsAt.getTime(),
    timeZone: row.timeZone,
    komaEnabled: row.komaEnabled,
    cover: cover ? await signer.photo(cover) : null,
    photoCount: total?.n ?? 0,
    excludedEventIds: excluded.map((e) => e.id),
  };
}

/** しおりの行を、画面に返す形にする */
export function toItem(r: MemoryItemRow): MemoryItem {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    place: r.place,
    dayIndex: r.dayIndex,
    assigneeId: r.assigneeId,
    dueOn: r.dueOn,
    sortOrder: r.sortOrder,
    doneAt: r.doneAt?.getTime() ?? null,
    doneBy: r.doneBy,
    createdBy: r.createdBy,
  };
}
