/**
 * 拡張がお知らせの一覧に積み、端末にも知らせる口。土台に 1 つだけ置く。#32、0096
 *
 * kind ごとの「一覧に出す」「端末にも知らせる」の設定と、自分がした操作を自分に積まないことを、
 * ここで一度に確かめる。呼ぶ側は、相手・kind・payload(・push・groupKey)を渡すだけでよい。
 */
import { type KnownNotificationKind, notificationKindDefaults } from "@extensions/server/registry";
import type { DB } from "@server/core/db/client";
import { notifications, userSettings } from "@server/core/db/schema";
import { type PushPayload, sendPush } from "@server/core/push/send";
import type { NotificationPref } from "@shared/notifications";
import { and, eq, isNull, lt } from "drizzle-orm";

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
 * 積む相手から、自分がした操作の本人を外す。自分がした操作は自分には積まない。0096、issue #244
 * @param userIds 積む相手の候補。重なっていてもよい
 * @param actorId この出来事をした人。無ければ誰も外さない
 */
export function targetsExcludingActor(userIds: string[], actorId?: string): string[] {
  return uniqueUserIds(userIds).filter((id) => id !== actorId);
}

/**
 * 種類ごとの「一覧に出す」「端末にも知らせる」を決める。利用者が変えていればその値、
 * 変えていなければ拡張(か土台)が決めた既定を使う。0096、issue #244
 * @param stored user_settings.notification_prefs に持つ、その kind の値。変えていなければ無い
 * @param fallback その kind の既定
 */
export function resolvePreference(stored: NotificationPref | undefined, fallback: NotificationPref): NotificationPref {
  return stored ?? fallback;
}

export type NotifyInput = {
  db: DB;
  env: Env;
  /** 積む相手。自分を入れてもよい。actorId と同じ人は自動で外れる */
  userIds: string[];
  /** この出来事をした人。自分がした操作は自分に積まない。0096 */
  actorId?: string;
  kind: KnownNotificationKind;
  /** 一覧の 1 件を作る値。describeNotification が読む */
  payload: Record<string, unknown>;
  /** 端末にも知らせるときの中身。無ければ push は送らない */
  push?: PushPayload;
  /**
   * 同じ相手の出来事を、既読になるまで 1 行にまとめる目印(例: 予定の ID、リストの ID)。
   * 無ければまとめない。payload.count があれば積み増し、無ければ 1 件ぶんとして数える。0096
   */
  groupKey?: string;
  /**
   * 1 日 1 回など、既読かどうかを問わず、同じ目印の行が既にあれば積まない目印。
   * groupKey と同時には使わない。0096
   */
  dedupeKey?: string;
};

/** 利用者の、その kind の設定。無ければ既定を使う */
async function preferenceFor(db: DB, userId: string, kind: string): Promise<NotificationPref> {
  const row = await db
    .select({ notificationPrefs: userSettings.notificationPrefs })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .get();
  return resolvePreference(row?.notificationPrefs[kind], notificationKindDefaults(kind));
}

/** payload の count。数でなければ 1 件ぶんとみなす */
function countOf(payload: Record<string, unknown>): number {
  return typeof payload.count === "number" && payload.count > 0 ? payload.count : 1;
}

/**
 * 既読になるまで同じ相手をまとめるときの、積み増した payload。件数(count)を足し合わせ、
 * それ以外は新しい出来事の値で置き換える(いちばん新しい actor の名前などを出すため)。0096、issue #244
 * @param existing 未読で既にある行の payload。まとめる相手が無ければ渡さない
 * @param incoming 今回の出来事の payload
 */
export function mergedPayload(
  existing: Record<string, unknown> | undefined,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  if (!existing) return { ...incoming, count: countOf(incoming) };
  return { ...incoming, count: countOf(existing) + countOf(incoming) };
}

/** 一覧に 1 行積む。groupKey があり、未読の同じ行があれば、件数を足して新しい順に上げる */
async function appendToList(
  db: DB,
  userId: string,
  kind: string,
  payload: Record<string, unknown>,
  groupKey: string | undefined,
  now: Date,
): Promise<void> {
  if (groupKey) {
    const existing = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.kind, kind),
          eq(notifications.groupKey, groupKey),
          isNull(notifications.readAt),
        ),
      )
      .get();
    if (existing) {
      const merged = mergedPayload(existing.payload as Record<string, unknown>, payload);
      await db.update(notifications).set({ payload: merged, createdAt: now }).where(eq(notifications.id, existing.id));
      return;
    }
  }
  await db.insert(notifications).values({
    id: crypto.randomUUID(),
    userId,
    kind,
    payload: mergedPayload(undefined, payload),
    groupKey: groupKey ?? null,
    createdAt: now,
  });
}

/** dedupeKey の行が、既読かどうかを問わず既にあるか */
async function alreadyDeduped(db: DB, userId: string, kind: string, dedupeKey: string): Promise<boolean> {
  const row = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.kind, kind), eq(notifications.groupKey, dedupeKey)))
    .get();
  return row !== undefined;
}

/**
 * 人にお知らせを積み、端末にも知らせる。拡張はこれを呼ぶだけで、表の形も設定の確かめ方も知らなくてよい。
 *
 * 1. actorId と同じ人を外す(自分がした操作は自分に積まない)
 * 2. 残った相手ごとに、その kind の設定を読む
 * 3. 「一覧に出す」なら 1 行積む(groupKey があれば未読の同じ行にまとめる)
 * 4. 「端末にも知らせる」なら push を送る
 */
export async function notify(input: NotifyInput): Promise<void> {
  const targets = targetsExcludingActor(input.userIds, input.actorId);
  if (targets.length === 0) return;
  const now = new Date();
  for (const userId of targets) {
    if (input.dedupeKey && (await alreadyDeduped(input.db, userId, input.kind, input.dedupeKey))) continue;
    const pref = await preferenceFor(input.db, userId, input.kind);
    if (pref.list) {
      const groupKey = input.dedupeKey ?? input.groupKey;
      await appendToList(input.db, userId, input.kind, input.payload, groupKey, now);
    }
    if (pref.push && input.push) await sendPush(input.db, input.env, [userId], input.push);
  }
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
