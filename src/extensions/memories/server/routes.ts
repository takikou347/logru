import { zValidator } from "@hono/zod-validator";
import { and, asc, count, desc, eq, inArray, max } from "drizzle-orm";
import type { Context } from "hono";
import { type AppEnv, HttpError, createRouter, validationHook } from "@server/core/app";
import { requireAgreement, requireUser } from "@server/core/auth/middleware";
import type { DB } from "@server/core/db/client";
import { groupMembers } from "@server/core/db/schema";
import { MAX_MEMORY_DAYS, addDaysToKey, dayKeyIn, startOfDayIn } from "../shared/days";
import {
  PHOTO_LIMITS,
  itemCopyInput,
  itemInput,
  itemPatchInput,
  memoryInput,
  memoryPatchInput,
  recordInput,
  recordPatchInput,
  eventLinkInput,
  recordsQuery,
} from "../shared/schemas";
import type { MemoryDetail, MemoryList } from "../shared/types";
import { requireMemoriesGroup, usableGroupIds } from "./access";
import { komaRoutes } from "./koma";
import { loadRecord, loadRecords, recentRecords, toItem, toMemory } from "./load";
import { PhotoSigner, type PhotoSize, isJpeg, photoKey, verifyPhotoUrl } from "./photos";
import { memories, memoryEventExclusions, memoryItems, memoryLikes, memoryPhotos, memoryRecords } from "./schema";

const signer = (c: Context<AppEnv>) => new PhotoSigner(c.env.MEMORIES_PHOTO_KEY);

/** 思い出を読み、そのグループで使えるかを確かめる。違えば 404 */
async function loadMemory(db: DB, userId: string, id: string) {
  const row = await db.select().from(memories).where(eq(memories.id, id)).get();
  if (!row) throw new HttpError(404, "思い出が見つかりません。");
  await requireMemoriesGroup(db, userId, row.groupId);
  return row;
}

/** 記録を読み、そのグループで使えるかを確かめる。違えば 404 */
async function loadRecordRow(db: DB, userId: string, id: string) {
  const row = await db.select().from(memoryRecords).where(eq(memoryRecords.id, id)).get();
  if (!row) throw new HttpError(404, "記録が見つかりません。");
  await requireMemoriesGroup(db, userId, row.groupId);
  return row;
}

/**
 * 期間を、時間帯での 0 時に直す。ends_at は最後の日の次の 0 時で、含まない。
 * @param firstDay 初日。`2026-09-19` の形
 * @param lastDay 最後の日
 * @param timeZone 時間帯
 */
function periodOf(firstDay: string, lastDay: string, timeZone: string) {
  const startsAt = startOfDayIn(firstDay, timeZone);
  const endsAt = startOfDayIn(addDaysToKey(lastDay, 1), timeZone);
  if (endsAt <= startsAt) throw new HttpError(400, "終わりは始まりより後にしてください。");
  if (endsAt - startsAt > (MAX_MEMORY_DAYS + 1) * 86_400_000) throw new HttpError(400, `期間は ${MAX_MEMORY_DAYS} 日までです。`);
  return { startsAt: new Date(startsAt), endsAt: new Date(endsAt) };
}

/** その人がグループのメンバーか。担当する人を選ぶときに使う */
async function isMember(db: DB, groupId: string, userId: string): Promise<boolean> {
  const row = await db
    .select({ id: groupMembers.userId })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .get();
  return row !== undefined;
}

/**
 * 記録に付ける写真を確かめる。自分が送り、同じグループで、まだほかの記録に付いていないものだけ。
 * @param recordId 直すときは、その記録。既に付いている写真も受け付ける
 */
async function requirePhotos(db: DB, userId: string, groupId: string, ids: string[], recordId?: string) {
  if (ids.length === 0) return;
  const rows = await db.select().from(memoryPhotos).where(inArray(memoryPhotos.id, ids));
  const ok = rows.filter((p) => p.createdBy === userId && p.groupId === groupId && (p.recordId === null || p.recordId === recordId));
  if (ok.length !== new Set(ids).size) throw new HttpError(400, "付けられない写真があります。送り直してください。");
  return rows;
}

/**
 * `/api/memories`。思い出、しおり、記録、写真、いいね。docs/logru/extensions/memories/design.md
 *
 * 写真を返す 1 本だけは、ID トークンの代わりに URL の署名を確かめる。`img` の要求にトークンを付けられないため。0021
 */
export const memoryRoutes = createRouter()
  .get("/photos/:photoId/:size", async (c) => {
    const { photoId } = c.req.param();
    const size = c.req.param("size") as PhotoSize;
    if (size !== "full" && size !== "thumb") throw new HttpError(404, "見つかりません。");
    const ok = await verifyPhotoUrl(c.env.MEMORIES_PHOTO_KEY, photoId, size, Number(c.req.query("e")), c.req.query("s") ?? "");
    if (!ok) throw new HttpError(403, "写真の URL の期限が切れています。画面を読み直してください。");
    const row = await c.get("db").select({ id: memoryPhotos.id }).from(memoryPhotos).where(eq(memoryPhotos.id, photoId)).get();
    if (!row) throw new HttpError(404, "写真が見つかりません。");
    const object = await c.env.MEMORIES_BUCKET.get(photoKey(photoId, size));
    if (!object) throw new HttpError(404, "写真が見つかりません。");
    return new Response(object.body, {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400, immutable", ETag: object.httpEtag },
    });
  })
  .use("*", requireUser, requireAgreement)
  // ひとコマ。`/:id` より先に載せる。後に置くと `/koma` が思い出の ID として読まれる
  .route("/koma", komaRoutes)
  .get("/", async (c) => {
    const db = c.get("db");
    const wanted = c.req.query("group")?.split(",").filter(Boolean);
    const groupIds = await usableGroupIds(db, c.get("user").id, wanted);
    if (groupIds.length === 0) return c.json({ memories: [], recent: [] } satisfies MemoryList);
    const rows = await db.select().from(memories).where(inArray(memories.groupId, groupIds)).orderBy(desc(memories.startsAt));
    const s = signer(c);
    const body: MemoryList = {
      memories: await Promise.all(rows.map((r) => toMemory(db, s, r))),
      recent: await recentRecords(db, s, groupIds),
    };
    return c.json(body);
  })
  .post("/", zValidator("json", memoryInput, validationHook), async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const input = c.req.valid("json");
    await requireMemoriesGroup(db, me.id, input.groupId);
    const id = crypto.randomUUID();
    await db.insert(memories).values({
      id,
      groupId: input.groupId,
      createdBy: me.id,
      title: input.title,
      place: input.place || null,
      timeZone: input.timeZone,
      komaEnabled: input.komaEnabled,
      ...periodOf(input.firstDay, input.lastDay, input.timeZone),
    });
    if (input.excludedEventIds.length) {
      await db.insert(memoryEventExclusions).values([...new Set(input.excludedEventIds)].map((eventId) => ({ memoryId: id, eventId })));
    }
    return c.json(await toMemory(db, signer(c), (await db.select().from(memories).where(eq(memories.id, id)).get())!), 201);
  })
  .get("/records", zValidator("query", recordsQuery, validationHook), async (c) => {
    const db = c.get("db");
    const { group, from, to } = c.req.valid("query");
    const groupIds = await usableGroupIds(db, c.get("user").id, group?.split(",").filter(Boolean));
    return c.json({ records: await loadRecords(db, signer(c), groupIds, from, to) });
  })
  .post("/photos", async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const form = await c.req.formData().catch(() => null);
    if (!form) throw new HttpError(400, "写真を送り直してください。");
    const groupId = String(form.get("groupId") ?? "");
    await requireMemoriesGroup(db, me.id, groupId);
    const full = form.get("full");
    const thumb = form.get("thumb");
    const tiny = String(form.get("tiny") ?? "");
    const width = Number(form.get("width"));
    const height = Number(form.get("height"));
    const takenAtRaw = Number(form.get("takenAt"));
    if (!(full instanceof File) || !(thumb instanceof File)) throw new HttpError(400, "写真を送り直してください。");
    if (full.size > PHOTO_LIMITS.fullBytes || thumb.size > PHOTO_LIMITS.thumbBytes || tiny.length > PHOTO_LIMITS.tinyChars) {
      return c.json({ error: "写真が大きすぎます。" }, 413);
    }
    if (!tiny.startsWith("data:image/jpeg;base64,")) throw new HttpError(400, "写真を送り直してください。");
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new HttpError(400, "写真を送り直してください。");
    const [fullBytes, thumbBytes] = await Promise.all([full.arrayBuffer(), thumb.arrayBuffer()]);
    if (!isJpeg(new Uint8Array(fullBytes)) || !isJpeg(new Uint8Array(thumbBytes))) throw new HttpError(400, "JPEG の写真だけを受け付けます。");
    const total = await db.select({ n: count() }).from(memoryPhotos).where(eq(memoryPhotos.groupId, groupId)).get();
    if ((total?.n ?? 0) >= PHOTO_LIMITS.perGroup) {
      throw new HttpError(409, `このグループの写真は ${PHOTO_LIMITS.perGroup} 枚までです。古い記録を消してから足してください。`);
    }
    const id = crypto.randomUUID();
    await Promise.all([
      c.env.MEMORIES_BUCKET.put(photoKey(id, "full"), fullBytes, { httpMetadata: { contentType: "image/jpeg" } }),
      c.env.MEMORIES_BUCKET.put(photoKey(id, "thumb"), thumbBytes, { httpMetadata: { contentType: "image/jpeg" } }),
    ]);
    await db.insert(memoryPhotos).values({
      id,
      groupId,
      createdBy: me.id,
      width,
      height,
      bytes: fullBytes.byteLength + thumbBytes.byteLength,
      takenAt: Number.isFinite(takenAtRaw) && takenAtRaw > 0 ? new Date(takenAtRaw) : null,
      tiny,
    });
    const row = (await db.select().from(memoryPhotos).where(eq(memoryPhotos.id, id)).get())!;
    return c.json(await signer(c).photo(row), 201);
  })
  .post("/records", zValidator("json", recordInput, validationHook), async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const input = c.req.valid("json");
    await requireMemoriesGroup(db, me.id, input.groupId);
    const photos = (await requirePhotos(db, me.id, input.groupId, input.photoIds)) ?? [];
    const firstTaken = input.photoIds.map((id) => photos.find((p) => p.id === id)?.takenAt).find(Boolean);
    const occurredAt = new Date(Math.min(input.occurredAt ?? firstTaken?.getTime() ?? Date.now(), Date.now()));
    requireNotFuture(input.occurredAt);
    const item = input.itemId ? await db.select().from(memoryItems).where(eq(memoryItems.id, input.itemId)).get() : undefined;
    if (input.itemId) {
      const owner = item ? await db.select().from(memories).where(eq(memories.id, item.memoryId)).get() : undefined;
      if (!item || item.kind !== "wish" || owner?.groupId !== input.groupId) throw new HttpError(400, "そのやりたいことは選べません。");
    }
    const id = crypto.randomUUID();
    const now = new Date();
    await db.batch([
      db.insert(memoryRecords).values({ id, groupId: input.groupId, createdBy: me.id, body: input.body || null, occurredAt, itemId: input.itemId }),
      ...input.photoIds.map((pid, i) => db.update(memoryPhotos).set({ recordId: id, sortOrder: i }).where(eq(memoryPhotos.id, pid))),
      ...(item ? [db.update(memoryItems).set({ doneAt: occurredAt, doneBy: me.id, updatedAt: now }).where(eq(memoryItems.id, item.id))] : []),
    ] as unknown as Parameters<typeof db.batch>[0]);
    return c.json(await loadRecord(db, signer(c), id), 201);
  })
  .patch("/records/:recordId", zValidator("json", recordPatchInput, validationHook), async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const row = await loadRecordRow(db, me.id, c.req.param("recordId"));
    if (row.createdBy !== me.id) throw new HttpError(403, "記録を編集できるのは、記録した人だけです。");
    const input = c.req.valid("json");
    requireNotFuture(input.occurredAt);
    const current = await db.select({ id: memoryPhotos.id }).from(memoryPhotos).where(eq(memoryPhotos.recordId, row.id));
    const nextIds = input.photoIds ?? current.map((p) => p.id);
    const body = input.body === undefined ? row.body : input.body || null;
    if (!body && nextIds.length === 0) throw new HttpError(400, "写真か文章を入力してください。");
    if (row.kind === "koma" && nextIds.length === 0) throw new HttpError(400, "ひとコマの写真は外せません。不要なときは記録ごと削除してください。");
    await requirePhotos(db, me.id, row.groupId, nextIds, row.id);
    const removed = current.map((p) => p.id).filter((id) => !nextIds.includes(id));
    await db.batch([
      db
        .update(memoryRecords)
        .set({ body, occurredAt: input.occurredAt ? new Date(input.occurredAt) : row.occurredAt, updatedAt: new Date() })
        .where(eq(memoryRecords.id, row.id)),
      ...(removed.length ? [db.delete(memoryPhotos).where(inArray(memoryPhotos.id, removed))] : []),
      ...nextIds.map((pid, i) => db.update(memoryPhotos).set({ recordId: row.id, sortOrder: i }).where(eq(memoryPhotos.id, pid))),
    ] as unknown as Parameters<typeof db.batch>[0]);
    return c.json(await loadRecord(db, signer(c), row.id));
  })
  .delete("/records/:recordId", async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const row = await loadRecordRow(db, me.id, c.req.param("recordId"));
    if (row.createdBy !== me.id) throw new HttpError(403, "記録を削除できるのは、記録した人だけです。");
    // 写真といいねは外部キーで消える。写真の行が消えると、トリガーが R2 の鍵を消す待ちに積む
    await db.delete(memoryRecords).where(eq(memoryRecords.id, row.id));
    return c.body(null, 204);
  })
  .put("/records/:recordId/like", async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const row = await loadRecordRow(db, me.id, c.req.param("recordId"));
    await db.insert(memoryLikes).values({ recordId: row.id, userId: me.id }).onConflictDoNothing();
    return c.json({ likes: await likesOf(db, row.id) });
  })
  .delete("/records/:recordId/like", async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const row = await loadRecordRow(db, me.id, c.req.param("recordId"));
    await db.delete(memoryLikes).where(and(eq(memoryLikes.recordId, row.id), eq(memoryLikes.userId, me.id)));
    return c.json({ likes: await likesOf(db, row.id) });
  })
  .get("/:id", async (c) => {
    const db = c.get("db");
    const row = await loadMemory(db, c.get("user").id, c.req.param("id"));
    const items = await db.select().from(memoryItems).where(eq(memoryItems.memoryId, row.id)).orderBy(asc(memoryItems.sortOrder), asc(memoryItems.createdAt));
    const s = signer(c);
    const records = await loadRecords(db, s, [row.groupId], row.startsAt.getTime(), row.endsAt.getTime());
    const memory = await toMemory(db, s, row);
    const days = Math.round((row.endsAt.getTime() - row.startsAt.getTime()) / 86_400_000);
    const first = dayKeyIn(row.startsAt.getTime(), row.timeZone);
    const dayCounts = Array.from({ length: Math.max(1, days) }, (_, i) => {
      const key = addDaysToKey(first, i);
      return records.filter((r) => dayKeyIn(r.occurredAt, row.timeZone) === key).reduce((n, r) => n + r.photos.length, 0);
    });
    return c.json({ memory, items: items.map(toItem), dayCounts } satisfies MemoryDetail);
  })
  .patch("/:id", zValidator("json", memoryPatchInput, validationHook), async (c) => {
    const db = c.get("db");
    const row = await loadMemory(db, c.get("user").id, c.req.param("id"));
    const input = c.req.valid("json");
    const timeZone = input.timeZone ?? row.timeZone;
    const firstDay = input.firstDay ?? dayKeyIn(row.startsAt.getTime(), row.timeZone);
    const lastDay = input.lastDay ?? dayKeyIn(row.endsAt.getTime() - 1, row.timeZone);
    if (input.coverPhotoId) {
      const photo = await db.select().from(memoryPhotos).where(eq(memoryPhotos.id, input.coverPhotoId)).get();
      if (!photo || photo.groupId !== row.groupId) throw new HttpError(400, "その写真は表紙にできません。");
    }
    await db
      .update(memories)
      .set({
        title: input.title ?? row.title,
        place: input.place === undefined ? row.place : input.place || null,
        timeZone,
        komaEnabled: input.komaEnabled ?? row.komaEnabled,
        coverPhotoId: input.coverPhotoId === undefined ? row.coverPhotoId : input.coverPhotoId,
        ...periodOf(firstDay, lastDay, timeZone),
        updatedAt: new Date(),
      })
      .where(eq(memories.id, row.id));
    if (input.excludedEventIds) {
      const ids = [...new Set(input.excludedEventIds)];
      await db.batch([
        db.delete(memoryEventExclusions).where(eq(memoryEventExclusions.memoryId, row.id)),
        ...(ids.length ? [db.insert(memoryEventExclusions).values(ids.map((eventId) => ({ memoryId: row.id, eventId })))] : []),
      ] as unknown as Parameters<typeof db.batch>[0]);
    }
    return c.json(await toMemory(db, signer(c), (await db.select().from(memories).where(eq(memories.id, row.id)).get())!));
  })
  .put("/:id/events/:eventId", zValidator("json", eventLinkInput, validationHook), async (c) => {
    const db = c.get("db");
    const row = await loadMemory(db, c.get("user").id, c.req.param("id"));
    const eventId = c.req.param("eventId");
    // 入れるなら外した印を消し、外すなら印を置く。予定が期間とグループに合うかは、画面が決めて送る
    if (c.req.valid("json").included) {
      await db.delete(memoryEventExclusions).where(and(eq(memoryEventExclusions.memoryId, row.id), eq(memoryEventExclusions.eventId, eventId)));
    } else {
      await db.insert(memoryEventExclusions).values({ memoryId: row.id, eventId }).onConflictDoNothing();
    }
    return c.json(await toMemory(db, signer(c), row));
  })
  .delete("/:id", async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const row = await loadMemory(db, me.id, c.req.param("id"));
    if (row.createdBy !== me.id) throw new HttpError(403, "思い出を削除できるのは、作った人だけです。");
    // しおりの行は外部キーで消える。記録は思い出に属さないので残る。0020
    await db.delete(memories).where(eq(memories.id, row.id));
    return c.body(null, 204);
  })
  .post("/:id/items", zValidator("json", itemInput, validationHook), async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const row = await loadMemory(db, me.id, c.req.param("id"));
    const input = c.req.valid("json");
    if (input.assigneeId && !(await isMember(db, row.groupId, input.assigneeId))) throw new HttpError(400, "担当はグループのメンバーから選んでください。");
    const last = await db.select({ n: max(memoryItems.sortOrder) }).from(memoryItems).where(eq(memoryItems.memoryId, row.id)).get();
    const id = crypto.randomUUID();
    await db.insert(memoryItems).values({
      id,
      memoryId: row.id,
      kind: input.kind,
      createdBy: me.id,
      title: input.title,
      place: input.kind === "wish" ? input.place || null : null,
      dayIndex: input.kind === "wish" ? input.dayIndex : null,
      assigneeId: input.kind === "wish" ? null : input.assigneeId,
      dueOn: input.kind === "todo" ? input.dueOn : null,
      sortOrder: (last?.n ?? 0) + 1,
    });
    return c.json(toItem((await db.select().from(memoryItems).where(eq(memoryItems.id, id)).get())!), 201);
  })
  .post("/:id/items/copy", zValidator("json", itemCopyInput, validationHook), async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const row = await loadMemory(db, me.id, c.req.param("id"));
    const from = await loadMemory(db, me.id, c.req.valid("json").fromMemoryId);
    const source = await db
      .select()
      .from(memoryItems)
      .where(and(eq(memoryItems.memoryId, from.id), eq(memoryItems.kind, "packing")))
      .orderBy(asc(memoryItems.sortOrder));
    const existing = await db
      .select({ title: memoryItems.title })
      .from(memoryItems)
      .where(and(eq(memoryItems.memoryId, row.id), eq(memoryItems.kind, "packing")));
    const have = new Set(existing.map((e) => e.title));
    const last = await db.select({ n: max(memoryItems.sortOrder) }).from(memoryItems).where(eq(memoryItems.memoryId, row.id)).get();
    const members = await db.select({ id: groupMembers.userId }).from(groupMembers).where(eq(groupMembers.groupId, row.groupId));
    const memberIds = new Set(members.map((m) => m.id));
    // 同じ名前の持ち物は写さない。担当は、写す先のグループにいる人だけ残す。印は外す
    const values = source
      .filter((s) => !have.has(s.title))
      .map((s, i) => ({
        id: crypto.randomUUID(),
        memoryId: row.id,
        kind: "packing" as const,
        createdBy: me.id,
        title: s.title,
        assigneeId: s.assigneeId && memberIds.has(s.assigneeId) ? s.assigneeId : null,
        sortOrder: (last?.n ?? 0) + i + 1,
      }));
    if (values.length) await db.insert(memoryItems).values(values);
    const items = await db.select().from(memoryItems).where(eq(memoryItems.memoryId, row.id)).orderBy(asc(memoryItems.sortOrder));
    return c.json({ items: items.map(toItem), copied: values.length });
  })
  .patch("/:id/items/:itemId", zValidator("json", itemPatchInput, validationHook), async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const row = await loadMemory(db, me.id, c.req.param("id"));
    const item = await db
      .select()
      .from(memoryItems)
      .where(and(eq(memoryItems.id, c.req.param("itemId")), eq(memoryItems.memoryId, row.id)))
      .get();
    if (!item) throw new HttpError(404, "見つかりません。");
    const input = c.req.valid("json");
    if (input.assigneeId && !(await isMember(db, row.groupId, input.assigneeId))) throw new HttpError(400, "担当はグループのメンバーから選んでください。");
    const done = input.done === undefined ? undefined : input.done ? { doneAt: new Date(), doneBy: me.id } : { doneAt: null, doneBy: null };
    await db
      .update(memoryItems)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.place !== undefined && item.kind === "wish" ? { place: input.place || null } : {}),
        ...(input.dayIndex !== undefined && item.kind === "wish" ? { dayIndex: input.dayIndex } : {}),
        ...(input.assigneeId !== undefined && item.kind !== "wish" ? { assigneeId: input.assigneeId } : {}),
        ...(input.dueOn !== undefined && item.kind === "todo" ? { dueOn: input.dueOn } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(done ?? {}),
        updatedAt: new Date(),
      })
      .where(eq(memoryItems.id, item.id));
    return c.json(toItem((await db.select().from(memoryItems).where(eq(memoryItems.id, item.id)).get())!));
  })
  .delete("/:id/items/:itemId", async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const row = await loadMemory(db, me.id, c.req.param("id"));
    const item = await db
      .select()
      .from(memoryItems)
      .where(and(eq(memoryItems.id, c.req.param("itemId")), eq(memoryItems.memoryId, row.id)))
      .get();
    if (!item) throw new HttpError(404, "見つかりません。");
    if (item.createdBy !== me.id) throw new HttpError(403, "削除できるのは、追加した人だけです。");
    await db.delete(memoryItems).where(eq(memoryItems.id, item.id));
    return c.body(null, 204);
  });

/** 端末の時計のずれを見込んで、この先まで受け付ける。10 分 */
const CLOCK_SKEW_MS = 10 * 60 * 1000;

/** 未来の時刻の記録は断る。まだ起きていないことは記録できない */
function requireNotFuture(at: number | undefined) {
  if (at !== undefined && at > Date.now() + CLOCK_SKEW_MS) throw new HttpError(400, "未来の時刻には記録できません。");
}

/** 記録にいいねを付けた人。付けた順 */
async function likesOf(db: DB, recordId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: memoryLikes.userId })
    .from(memoryLikes)
    .where(eq(memoryLikes.recordId, recordId))
    .orderBy(asc(memoryLikes.createdAt));
  return rows.map((r) => r.userId);
}

