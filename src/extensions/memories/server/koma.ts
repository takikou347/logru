/** ひとコマの API と、知らせを送る定期の処理。0022、0023 */
import { zValidator } from "@hono/zod-validator";
import { createRouter, HttpError, validationHook } from "@server/core/app";
import type { DB } from "@server/core/db/client";
import { groupExtensions, groupMembers } from "@server/core/db/schema";
import { sendPush } from "@server/core/push/send";
import { and, desc, eq, gt, gte, inArray, lt, lte, ne } from "drizzle-orm";
import { memoriesManifest } from "../manifest";
import { addDaysToKey, DAY_MS, dayIndexOf, dayKeyIn, hourIn, startOfDayIn } from "../shared/days";
import { KOMA_FIRST_HOUR, openSlots, slotAt } from "../shared/koma";
import { komaDayInput, komaInput } from "../shared/schemas";
import type { KomaDay, KomaNow } from "../shared/types";
import { requireMemoriesGroup, usableGroupIds, usersUsingMemories } from "./access";
import { withPhotos } from "./load";
import { PhotoSigner } from "./photos";
import { type KomaDayRow, memories, memoryKomaDays, memoryKomaNotices, memoryPhotos, memoryRecords } from "./schema";

/** 1 回の定期の処理で送る知らせの人数。Workers の CPU 時間に収めるため。0023 */
const PUSH_PER_RUN = 20;
/** 枠の始まりから、この時間のうちだけ知らせる。遅れて送らない */
const NOTICE_WINDOW_MS = 10 * 60 * 1000;

const timeZoneOf = (tz: string | undefined) => {
  try {
    if (tz) new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz || "Asia/Tokyo";
  } catch {
    return "Asia/Tokyo";
  }
};

/** その日を含み、ひとコマを有効にした思い出。使えるグループのものだけ */
async function komaMemoryOn(db: DB, groupIds: string[], at: number) {
  if (groupIds.length === 0) return undefined;
  return db
    .select()
    .from(memories)
    .where(
      and(
        inArray(memories.groupId, groupIds),
        eq(memories.komaEnabled, true),
        lte(memories.startsAt, new Date(at)),
        gt(memories.endsAt, new Date(at)),
      ),
    )
    .orderBy(desc(memories.startsAt))
    .get();
}

/**
 * 今日の行を返す。無くても、今日を含む思い出でひとコマを有効にしていれば、その思い出とグループで作る。0022
 * @param tz 端末の時間帯
 */
async function todayRow(db: DB, userId: string, now: number, tz: string): Promise<KomaDayRow | undefined> {
  const day = dayKeyIn(now, tz);
  const usable = await usableGroupIds(db, userId);
  const found = await db
    .select()
    .from(memoryKomaDays)
    .where(and(eq(memoryKomaDays.userId, userId), eq(memoryKomaDays.day, day)))
    .get();
  // つないだグループで思い出が使えなくなったら、始めていない扱いにする。始め直すと、別のグループにつなぎ直せる
  if (found) return usable.includes(found.groupId) ? found : undefined;
  const memory = await komaMemoryOn(db, usable, now);
  if (!memory) return undefined;
  const row = {
    userId,
    day: dayKeyIn(now, memory.timeZone),
    groupId: memory.groupId,
    memoryId: memory.id,
    timeZone: memory.timeZone,
  };
  await db.insert(memoryKomaDays).values(row).onConflictDoNothing();
  return db
    .select()
    .from(memoryKomaDays)
    .where(and(eq(memoryKomaDays.userId, userId), eq(memoryKomaDays.day, row.day)))
    .get();
}

/** その日のひとコマの記録。日の始まりから 26 時間の中の枠で拾う */
function komaRecordsOf(db: DB, userIds: string[], dayStart: number) {
  return db
    .select()
    .from(memoryRecords)
    .where(
      and(
        inArray(memoryRecords.createdBy, userIds),
        eq(memoryRecords.kind, "koma"),
        gte(memoryRecords.komaSlot, new Date(dayStart)),
        lt(memoryRecords.komaSlot, new Date(dayStart + DAY_MS)),
      ),
    )
    .orderBy(memoryRecords.komaSlot);
}

/** `/api/memories/koma`。memoryRoutes の中に、ログインの確かめの後で載せる */
export const komaRoutes = createRouter()
  .get("/now", async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const now = Date.now();
    const tz = timeZoneOf(c.req.query("tz"));
    const row = await todayRow(db, me.id, now, tz);
    const zone = row?.timeZone ?? tz;
    const slot = slotAt(now, zone);
    const open = openSlots(now, zone);
    const signer = new PhotoSigner(c.env.MEMORIES_PHOTO_KEY);
    let taken = false;
    let last = null;
    let others: KomaNow["others"] = [];
    if (row) {
      const dayStart = startOfDayIn(row.day, zone);
      const mine = await withPhotos(db, signer, await komaRecordsOf(db, [me.id], dayStart));
      taken = slot ? mine.some((r) => r.komaSlot === slot.start) : false;
      last = mine.at(-1)?.photos[0] ?? null;
      if (slot) {
        const theirs = await db
          .select()
          .from(memoryRecords)
          .where(
            and(
              eq(memoryRecords.groupId, row.groupId),
              eq(memoryRecords.kind, "koma"),
              eq(memoryRecords.komaSlot, new Date(slot.start)),
              ne(memoryRecords.createdBy, me.id),
            ),
          );
        others = (await withPhotos(db, signer, theirs)).flatMap((r) =>
          r.photos[0] && r.createdBy ? [{ userId: r.createdBy, photo: r.photos[0] }] : [],
        );
      }
    }
    const memory = row?.memoryId
      ? await db
          .select({ id: memories.id, title: memories.title })
          .from(memories)
          .where(eq(memories.id, row.memoryId))
          .get()
      : undefined;
    const body: KomaNow = {
      day: row?.day ?? dayKeyIn(now, tz),
      started: Boolean(row),
      groupId: row?.groupId ?? null,
      memory: memory ?? null,
      muted: row?.muted ?? false,
      slot: slot ? { start: slot.start, hour: slot.hour } : null,
      open: open.map((s) => ({ start: s.start, hour: s.hour })),
      taken,
      last,
      others,
    };
    return c.json(body);
  })
  .get("/", async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const rows = await db
      .select()
      .from(memoryKomaDays)
      .where(eq(memoryKomaDays.userId, me.id))
      .orderBy(desc(memoryKomaDays.day))
      .limit(60);
    const usable = new Set(await usableGroupIds(db, me.id));
    const signer = new PhotoSigner(c.env.MEMORIES_PHOTO_KEY);
    const days: KomaDay[] = [];
    for (const row of rows.filter((r) => usable.has(r.groupId))) {
      const dayStart = startOfDayIn(row.day, row.timeZone);
      const records = await withPhotos(db, signer, await komaRecordsOf(db, [me.id], dayStart));
      const memory = row.memoryId
        ? await db.select().from(memories).where(eq(memories.id, row.memoryId)).get()
        : undefined;
      days.push({
        day: row.day,
        groupId: row.groupId,
        memory: memory
          ? {
              id: memory.id,
              title: memory.title,
              dayIndex: dayIndexOf(dayStart, {
                startsAt: memory.startsAt.getTime(),
                endsAt: memory.endsAt.getTime(),
                timeZone: memory.timeZone,
              }),
            }
          : null,
        timeZone: row.timeZone,
        muted: row.muted,
        records,
      });
    }
    return c.json({ days });
  })
  .put("/days/:day", zValidator("json", komaDayInput, validationHook), async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const day = c.req.param("day");
    const input = c.req.valid("json");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new HttpError(400, "日付が正しくありません。");
    await requireMemoriesGroup(db, me.id, input.groupId);
    const found = await db
      .select()
      .from(memoryKomaDays)
      .where(and(eq(memoryKomaDays.userId, me.id), eq(memoryKomaDays.day, day)))
      .get();
    const tz = found?.timeZone ?? input.timeZone;
    if (!found) {
      const today = dayKeyIn(Date.now(), tz);
      if (day !== today && day !== addDaysToKey(today, -1))
        throw new HttpError(400, "ひとコマを始められるのは、今日と昨日だけです。");
    }
    const dayStart = startOfDayIn(day, tz);
    if (input.memoryId) {
      const memory = await db.select().from(memories).where(eq(memories.id, input.memoryId)).get();
      if (
        !memory ||
        memory.groupId !== input.groupId ||
        memory.startsAt.getTime() > dayStart ||
        memory.endsAt.getTime() <= dayStart
      ) {
        throw new HttpError(400, "選べる思い出は、共有先のグループで、その日を含むものだけです。");
      }
    }
    const values = { groupId: input.groupId, memoryId: input.memoryId, muted: input.muted ?? found?.muted ?? false };
    await db
      .insert(memoryKomaDays)
      .values({ userId: me.id, day, timeZone: tz, ...values })
      .onConflictDoUpdate({ target: [memoryKomaDays.userId, memoryKomaDays.day], set: values });
    // グループを変えたら、その日のひとコマの見える人も変える。F-129
    if (found && found.groupId !== input.groupId) {
      const ids = (await komaRecordsOf(db, [me.id], dayStart)).map((r) => r.id);
      if (ids.length) {
        await db.batch([
          db
            .update(memoryRecords)
            .set({ groupId: input.groupId, updatedAt: new Date() })
            .where(inArray(memoryRecords.id, ids)),
          db.update(memoryPhotos).set({ groupId: input.groupId }).where(inArray(memoryPhotos.recordId, ids)),
        ]);
      }
    }
    return c.json({ day, ...values, timeZone: tz });
  })
  .put("/", zValidator("json", komaInput, validationHook), async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const input = c.req.valid("json");
    const now = Date.now();
    const rows = await db
      .select()
      .from(memoryKomaDays)
      .where(eq(memoryKomaDays.userId, me.id))
      .orderBy(desc(memoryKomaDays.day))
      .limit(2);
    const row = rows.find((r) => openSlots(now, r.timeZone).some((s) => s.start === input.slot && s.day === r.day));
    if (!row) throw new HttpError(409, "この時間のひとコマは、もう保存できません。次の時間に撮ってください。");
    const photo = await db.select().from(memoryPhotos).where(eq(memoryPhotos.id, input.photoId)).get();
    if (!photo || photo.createdBy !== me.id || photo.groupId !== row.groupId || photo.recordId)
      throw new HttpError(400, "写真を撮り直してください。");
    const existing = await db
      .select()
      .from(memoryRecords)
      .where(and(eq(memoryRecords.createdBy, me.id), eq(memoryRecords.komaSlot, new Date(input.slot))))
      .get();
    const id = existing?.id ?? crypto.randomUUID();
    await db.batch([
      existing
        ? db
            .update(memoryRecords)
            .set({ body: input.body, occurredAt: new Date(now), updatedAt: new Date() })
            .where(eq(memoryRecords.id, id))
        : db.insert(memoryRecords).values({
            id,
            groupId: row.groupId,
            createdBy: me.id,
            kind: "koma",
            body: input.body,
            occurredAt: new Date(now),
            komaSlot: new Date(input.slot),
          }),
      // 撮り直したら、前の写真を外す。行が消えると、トリガーが R2 から消す待ちに積む
      ...(existing
        ? [db.delete(memoryPhotos).where(and(eq(memoryPhotos.recordId, id), ne(memoryPhotos.id, photo.id)))]
        : []),
      db.update(memoryPhotos).set({ recordId: id, sortOrder: 0 }).where(eq(memoryPhotos.id, photo.id)),
    ] as unknown as Parameters<typeof db.batch>[0]);
    const [record] = await withPhotos(db, new PhotoSigner(c.env.MEMORIES_PHOTO_KEY), [
      (await db.select().from(memoryRecords).where(eq(memoryRecords.id, id)).get())!,
    ]);
    return c.json(record, existing ? 200 : 201);
  });

/**
 * ひとコマの知らせ。土台が 5 分おきに呼ぶ。0022、0023
 *
 * 1. ひとコマを有効にした思い出の期間の中で、7 時を過ぎていれば、メンバーの今日の行を作る
 * 2. 今日の行があり、止めておらず、いまの枠が始まって 10 分のうちで、まだ撮っていない人に知らせる
 *    知らせたしるしを先に入れ、入れられた人にだけ送る。2 重に送らない
 */
export async function notifyKoma(db: DB, env: Env): Promise<void> {
  const now = Date.now();
  const active = await db
    .select()
    .from(memories)
    .where(
      and(eq(memories.komaEnabled, true), lte(memories.startsAt, new Date(now)), gt(memories.endsAt, new Date(now))),
    );
  for (const m of active) {
    if (hourIn(now, m.timeZone) < KOMA_FIRST_HOUR) continue;
    const on = await db
      .select({ id: groupExtensions.groupId })
      .from(groupExtensions)
      .where(
        and(
          eq(groupExtensions.groupId, m.groupId),
          eq(groupExtensions.extensionKey, memoriesManifest.key),
          eq(groupExtensions.enabled, true),
        ),
      )
      .get();
    if (!on) continue;
    // 思い出を使わないと決めた人には、行を作らず知らせない
    const members = await usersUsingMemories(
      db,
      (await db.select({ id: groupMembers.userId }).from(groupMembers).where(eq(groupMembers.groupId, m.groupId))).map(
        (u) => u.id,
      ),
    );
    const day = dayKeyIn(now, m.timeZone);
    if (members.length) {
      await db
        .insert(memoryKomaDays)
        .values(members.map((id) => ({ userId: id, day, groupId: m.groupId, memoryId: m.id, timeZone: m.timeZone })))
        .onConflictDoNothing();
    }
  }

  const candidates = await db
    .select()
    .from(memoryKomaDays)
    .where(
      and(
        inArray(memoryKomaDays.day, [
          dayKeyIn(now - DAY_MS, "UTC"),
          dayKeyIn(now, "UTC"),
          dayKeyIn(now + DAY_MS, "UTC"),
        ]),
        eq(memoryKomaDays.muted, false),
      ),
    );
  let sent = 0;
  for (const row of candidates) {
    if (sent >= PUSH_PER_RUN) break;
    if (row.day !== dayKeyIn(now, row.timeZone)) continue;
    if ((await usersUsingMemories(db, [row.userId])).length === 0) continue;
    const slot = slotAt(now, row.timeZone);
    if (!slot || now - slot.start > NOTICE_WINDOW_MS) continue;
    const taken = await db
      .select({ id: memoryRecords.id })
      .from(memoryRecords)
      .where(and(eq(memoryRecords.createdBy, row.userId), eq(memoryRecords.komaSlot, new Date(slot.start))))
      .get();
    if (taken) continue;
    const marked = await db
      .insert(memoryKomaNotices)
      .values({ userId: row.userId, slot: new Date(slot.start) })
      .onConflictDoNothing()
      .returning()
      .get();
    if (!marked) continue;
    const memory = row.memoryId
      ? await db.select({ title: memories.title }).from(memories).where(eq(memories.id, row.memoryId)).get()
      : undefined;
    await sendPush(db, env, [row.userId], {
      title: memory?.title ?? "ひとコマ",
      body: `${slot.hour} 時のひとコマを撮りましょう`,
      path: "/memories/koma/now",
      tag: "koma",
    });
    sent += 1;
  }
  // 知らせたしるしは 2 日で消す
  await db.delete(memoryKomaNotices).where(lt(memoryKomaNotices.sentAt, new Date(now - 2 * DAY_MS)));
}
