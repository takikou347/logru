import { zValidator } from "@hono/zod-validator";
import { and, asc, count, eq } from "drizzle-orm";
import { HttpError, createRouter, isLocalDev, validationHook } from "../../../server/core/app";
import { requireAgreement, requireUser } from "../../../server/core/auth/middleware";
import type { DB } from "../../../server/core/db/client";
import { type ExternalCalendarSummary, externalCalendarInput } from "../shared/schemas";
import { MissingKeyError, decryptText, encryptText } from "./crypto";
import { sampleIcs } from "./sample";
import { type ExternalCalendarRow, externalCalendars } from "./schema";
import { SyncError, normalizeCalendarUrl, syncCalendar } from "./sync";

/** 1 人が登録できる数 */
const MAX_CALENDARS = 20;

/** 画面に返す形にする。URL は返さず、ホストだけを返す */
async function toSummary(row: ExternalCalendarRow, key: string | undefined): Promise<ExternalCalendarSummary> {
  let host = "";
  try {
    host = new URL(await decryptText(row.urlEncrypted, key)).host;
  } catch {
    // 鍵を変えたなどで読めなければ、ホストは出さない
  }
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    host,
    lastSyncedAt: row.lastSyncedAt?.getTime() ?? null,
    lastError: row.lastError,
  };
}

/** 自分のカレンダーを読む。ほかの人のものなら、あるかどうかも伝えず 404 */
async function loadMine(db: DB, userId: string, id: string): Promise<ExternalCalendarRow> {
  const row = await db
    .select()
    .from(externalCalendars)
    .where(and(eq(externalCalendars.id, id), eq(externalCalendars.userId, userId)))
    .get();
  if (!row) throw new HttpError(404, "カレンダーが見つかりません。");
  return row;
}

/**
 * `/api/external-calendars`。外部のカレンダーを登録する、一覧を見る、読み直す、消す。
 * 登録した本人だけが扱える。
 */
export const externalCalendarRoutes = createRouter()
  // E2E の見本。手元の開発のときだけ配る。ログインは要らない
  .get("/__test__/sample.ics", (c) => {
    if (!isLocalDev(c.env, c.req.url)) throw new HttpError(404, "見つかりません。");
    return c.body(sampleIcs(), 200, { "Content-Type": "text/calendar; charset=utf-8" });
  })
  .use("*", requireUser, requireAgreement)
  .get("/", async (c) => {
    const rows = await c
      .get("db")
      .select()
      .from(externalCalendars)
      .where(eq(externalCalendars.userId, c.get("user").id))
      .orderBy(asc(externalCalendars.createdAt));
    const key = c.env.EXTERNAL_CALENDAR_KEY;
    return c.json({ calendars: await Promise.all(rows.map((r) => toSummary(r, key))) });
  })
  .post("/", zValidator("json", externalCalendarInput, validationHook), async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const input = c.req.valid("json");
    const allowLocal = isLocalDev(c.env, c.req.url);
    let url: URL;
    try {
      url = normalizeCalendarUrl(input.url, allowLocal);
    } catch (e) {
      throw new HttpError(400, (e as SyncError).message);
    }
    const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(externalCalendars).where(eq(externalCalendars.userId, userId));
    if (n >= MAX_CALENDARS) throw new HttpError(400, `登録できるのは ${MAX_CALENDARS} 個までです。`);
    let urlEncrypted: string;
    try {
      urlEncrypted = await encryptText(url.toString(), c.env.EXTERNAL_CALENDAR_KEY);
    } catch (e) {
      if (e instanceof MissingKeyError) console.error(e.message);
      throw e;
    }
    const row = await db
      .insert(externalCalendars)
      .values({ id: crypto.randomUUID(), userId, name: input.name, color: input.color, urlEncrypted })
      .returning()
      .get();
    // 登録したらすぐ読む。読めなくても登録は残し、理由を一覧に出す
    await syncCalendar(db, c.env, row, allowLocal);
    return c.json(await toSummary(await loadMine(db, userId, row.id), c.env.EXTERNAL_CALENDAR_KEY), 201);
  })
  .post("/sync", async (c) => {
    // 自分のカレンダーをすべて読み直す。カレンダーの画面の読み直しのボタンから呼ぶ
    const db = c.get("db");
    const userId = c.get("user").id;
    const allowLocal = isLocalDev(c.env, c.req.url);
    const rows = await db
      .select()
      .from(externalCalendars)
      .where(eq(externalCalendars.userId, userId))
      .orderBy(asc(externalCalendars.createdAt));
    for (const row of rows) await syncCalendar(db, c.env, row, allowLocal);
    const after = await db
      .select()
      .from(externalCalendars)
      .where(eq(externalCalendars.userId, userId))
      .orderBy(asc(externalCalendars.createdAt));
    const key = c.env.EXTERNAL_CALENDAR_KEY;
    return c.json({ calendars: await Promise.all(after.map((r) => toSummary(r, key))) });
  })
  .post("/:id/sync", async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const row = await loadMine(db, userId, c.req.param("id"));
    await syncCalendar(db, c.env, row, isLocalDev(c.env, c.req.url));
    return c.json(await toSummary(await loadMine(db, userId, row.id), c.env.EXTERNAL_CALENDAR_KEY));
  })
  .delete("/:id", async (c) => {
    const db = c.get("db");
    const row = await loadMine(db, c.get("user").id, c.req.param("id"));
    // 予定の行は外部キーで一緒に消える
    await db.delete(externalCalendars).where(eq(externalCalendars.id, row.id));
    return c.body(null, 204);
  });
