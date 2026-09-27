/**
 * 拡張がお知らせの一覧に積む口。土台に 1 つだけ置く。0023 の sendPush と同じ考え方。#32
 *
 * push はブラウザーが閉じていても届くが、送り先が無ければ何も残らない。
 * notify は D1 に行として積むので、一覧を開けばいつでも読める。両方を呼んでもよいが、この関数は一覧にだけ積む。
 */
import type { DB } from "@server/core/db/client";
import { notifications } from "@server/core/db/schema";
import { lt } from "drizzle-orm";

/** 90 日を過ぎたお知らせを消すまでの猶予。仮の値。0032 */
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * 掃除を走らせる時間。協定世界時の 18 時。日本は夏時間が無いので、日本時間の 3 時に固定でよい。
 * Cron は 5 分おきなので、1 日 300 回のうち、この枠の 1 回だけ掃除する。0066、#162
 */
const CLEANUP_UTC_HOUR = 18;

/**
 * いまが、お知らせの掃除を走らせる枠か。Cron が 5 分おきなので、5 分の幅を持たせる。
 * @param now いまの時刻
 */
export function isNotificationCleanupWindow(now: Date): boolean {
  return now.getUTCHours() === CLEANUP_UTC_HOUR && now.getUTCMinutes() < 5;
}

/** 同じ人を 2 度渡しても、お知らせは 1 件だけ積む */
export function uniqueUserIds(userIds: string[]): string[] {
  return [...new Set(userIds)];
}

/**
 * 人にお知らせを積む。拡張はこれを呼ぶだけで、表の形を知らなくてよい。
 *
 * @param db D1 を包んだ Drizzle
 * @param userIds 積む相手
 * @param kind `<拡張の key>.<拡張が決めた名前>` の形。例は `events.invite_accepted`
 * @param payload 一覧の文言と行き先を作るのに使う、拡張が決めた形の値
 */
export async function notify(db: DB, userIds: string[], kind: string, payload: unknown): Promise<void> {
  const unique = uniqueUserIds(userIds);
  if (unique.length === 0) return;
  const now = new Date();
  await db
    .insert(notifications)
    .values(unique.map((userId) => ({ id: crypto.randomUUID(), userId, kind, payload, createdAt: now })));
}

/**
 * 90 日より前のお知らせを消す。5 分おきの定期処理から呼ばれるが、実際に掃除するのは 1 日 1 回だけ。
 * created_at だけの索引が無いと表を丸ごと読むので、5 分おきに走らせるのはやめた。0066、#162
 * @param now いまの時刻。既定は呼んだときの時刻
 */
export async function cleanupOldNotifications(db: DB, now: Date = new Date()): Promise<void> {
  if (!isNotificationCleanupWindow(now)) return;
  await db.delete(notifications).where(lt(notifications.createdAt, new Date(now.getTime() - RETENTION_MS)));
}
