/**
 * 外部のカレンダーを読み、予定の表を入れ替える。
 * 登録したとき、「今すぐ読み直す」やカレンダーの画面の読み直しを押したとき、Cron Triggers で 5 分おきに呼ぶ。
 */

import type { DB } from "@server/core/db/client";
import { asc, eq } from "drizzle-orm";
import { decryptText } from "./crypto";
import { DEFAULT_TIME_ZONE, type ParsedEvent, parseIcs, wallTimeToUtc } from "./ics";
import { type ExternalCalendarRow, externalCalendars } from "./schema";

/** 読む量の上限。これを超えるカレンダーは読まない */
const MAX_BYTES = 5 * 1024 * 1024;
/** 読むのを待つ時間 */
const FETCH_TIMEOUT_MS = 15_000;
/**
 * 1 回の Cron で読むカレンダーの数。CPU 時間の上限があるので、古い順に少しずつ読む。
 * Cron は 5 分おきなので、登録が全部で 5 つまでなら、どれも 5 分ごとに読み直す
 */
const CRON_BATCH = 5;

/**
 * 読む期間。日本時間で、今月の 1 日の 0 時から、2 か月先の月の末まで。
 * 例: 9 月 21 日なら、9 月 1 日 0 時から 12 月 1 日 0 時の前まで。to は含まない
 * @param now いまの時刻。ミリ秒の UTC
 */
export function syncWindow(now: number): { from: number; to: number } {
  const t = new Date(now + 9 * 60 * 60 * 1000);
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth() + 1;
  const from = wallTimeToUtc(y, m, 1, 0, 0, 0, DEFAULT_TIME_ZONE)!;
  const endY = y + Math.floor((m + 2) / 12);
  const endM = ((m + 2) % 12) + 1;
  const to = wallTimeToUtc(endY, endM, 1, 0, 0, 0, DEFAULT_TIME_ZONE)!;
  return { from, to };
}

/** 画面にそのまま出せる、読めなかった理由 */
export class SyncError extends Error {}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * 登録された URL を確かめ、読む URL にする。webcal:// は https:// に直す。
 * @param allowLocalHttp 手元の開発のときだけ true。http://localhost を許す
 * @throws {SyncError} 使えない URL のとき
 */
export function normalizeCalendarUrl(input: string, allowLocalHttp: boolean): URL {
  let url: URL;
  try {
    url = new URL(input.trim().replace(/^webcal:\/\//i, "https://"));
  } catch {
    throw new SyncError("URL の形ではありません。https:// から始まる URL を貼ってください。");
  }
  const local = allowLocalHttp && url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !local) throw new SyncError("https:// から始まる URL だけを登録できます。");
  if (url.username || url.password) throw new SyncError("ユーザー名やパスワードの入った URL は登録できません。");
  return url;
}

/**
 * URL から iCal の文字列を読む。時間と量に上限を置く。
 * @throws {SyncError} 読めなかったとき
 */
export async function fetchIcs(url: URL, fetcher: typeof fetch = fetch): Promise<string> {
  let res: Response;
  try {
    res = await fetcher(url.toString(), {
      headers: { Accept: "text/calendar" },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new SyncError("カレンダーにつながりませんでした。");
  }
  if (res.status === 404 || res.status === 403 || res.status === 401) {
    throw new SyncError("カレンダーが見つかりません。URL が古くなっていないか確かめてください。");
  }
  if (!res.ok) throw new SyncError(`カレンダーが読めませんでした（${res.status}）。`);
  if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES)
    throw new SyncError("カレンダーが大きすぎて読めません。");
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new SyncError("カレンダーが大きすぎて読めません。");
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

/** 1 つの文で入れる行の数。D1 の 1 行の大きさの上限より十分小さくする */
const INSERT_CHUNK = 400;

/**
 * そのカレンダーの予定を、読んだものにすべて入れ替え、読めた時刻を記録する。1 回の batch で書く。
 * 行は JSON にして 1 つの値で渡し、json_each で開く。D1 の 1 回あたりの問い合わせの数を抑えるため
 */
async function replaceEvents(db: DB, calendarId: string, events: ParsedEvent[], now: Date) {
  // Drizzle の batch は生の SQL を受けないので、D1 を直に使う
  const d1 = db.$client;
  const t = now.getTime();
  const statements = [d1.prepare("delete from external_events where calendar_id = ?").bind(calendarId)];
  for (let i = 0; i < events.length; i += INSERT_CHUNK) {
    const rows = events
      .slice(i, i + INSERT_CHUNK)
      .map((e) => [e.uid, e.occurrence, e.startsAt, e.endsAt, e.allDay ? 1 : 0, e.title, e.location]);
    statements.push(
      d1
        .prepare(
          `insert or ignore into external_events
            (calendar_id, uid, occurrence, starts_at, ends_at, all_day, title, location, updated_at)
            select ?1, value ->> 0, value ->> 1, value ->> 2, value ->> 3, value ->> 4, value ->> 5, value ->> 6, ?2
            from json_each(?3)`,
        )
        .bind(calendarId, t, JSON.stringify(rows)),
    );
  }
  statements.push(
    d1
      .prepare("update external_calendars set last_synced_at = ?1, last_error = null, updated_at = ?1 where id = ?2")
      .bind(t, calendarId),
  );
  await d1.batch(statements);
}

/**
 * 1 つのカレンダーを読み直す。失敗したら、前に読めた予定は残し、理由を記録する。
 * @param env Worker の環境変数。鍵を読む
 * @param allowLocalHttp 手元の開発のときだけ true
 * @returns 失敗したときの理由。読めたら null
 */
export async function syncCalendar(
  db: DB,
  env: Pick<Env, "EXTERNAL_CALENDAR_KEY">,
  row: ExternalCalendarRow,
  allowLocalHttp: boolean,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  const now = new Date();
  // 取りに行く前に updated_at を進める。読み込みが重くて Cron の 1 回が途中で終わっても、
  // 次の巡回では、このカレンダーより先にほかのカレンダーが回ってくる。0065、#161
  await db.update(externalCalendars).set({ updatedAt: now }).where(eq(externalCalendars.id, row.id));
  try {
    const url = normalizeCalendarUrl(await decryptText(row.urlEncrypted, env.EXTERNAL_CALENDAR_KEY), allowLocalHttp);
    const text = await fetchIcs(url, fetcher);
    let events: ParsedEvent[];
    try {
      events = parseIcs(text, syncWindow(now.getTime()));
    } catch {
      throw new SyncError("iCal の形として読めませんでした。「iCal 形式の非公開 URL」か確かめてください。");
    }
    await replaceEvents(db, row.id, events, now);
    return null;
  } catch (e) {
    if (!(e instanceof SyncError)) console.error("external calendar sync failed", row.id, e);
    const message = e instanceof SyncError ? e.message : "読み直せませんでした。時間をおいて、もう一度試してください。";
    await db
      .update(externalCalendars)
      .set({ lastError: message, updatedAt: now })
      .where(eq(externalCalendars.id, row.id));
    return message;
  }
}

/**
 * Cron Triggers から呼ぶ。読みに行ってから時間のたったカレンダーから順に、少しずつ読み直す。
 * @param env Worker の環境変数
 */
export async function syncDueCalendars(db: DB, env: Env): Promise<void> {
  const rows = await db
    .select()
    .from(externalCalendars)
    // 読んだたびに updated_at が進む。読めなかったものも後ろに回り、ほかのカレンダーを止めない
    .orderBy(asc(externalCalendars.updatedAt))
    .limit(CRON_BATCH);
  // 手元の開発の Cron では、E2E の見本の http://localhost も読めるようにする
  const allowLocalHttp = env.ENVIRONMENT === "development";
  for (const row of rows) await syncCalendar(db, env, row, allowLocalHttp);
}
