import type { DB } from "@server/core/db/client";
import { pushSubscriptions } from "@server/core/db/schema";
import { sendWebPush, type VapidKeys } from "@server/core/push/web-push";
import { eq, inArray, sql } from "drizzle-orm";

/** 知らせの中身。Service Worker の push-sw.js が読む */
export type PushPayload = {
  title: string;
  body: string;
  /** 押したときに開く画面のパス */
  path: string;
  /** 同じ札の知らせは、前のものを置き換える */
  tag: string;
};

/** 続けて失敗したら送り先を消す回数 */
const MAX_FAILURES = 5;

/** VAPID の鍵を環境変数から読む。無ければ知らせを送らない */
export function vapidKeys(env: Env): VapidKeys | null {
  const e = env as Env & { VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string; VAPID_SUBJECT?: string };
  if (!e.VAPID_PUBLIC_KEY || !e.VAPID_PRIVATE_KEY) return null;
  return {
    publicKey: e.VAPID_PUBLIC_KEY,
    privateKey: e.VAPID_PRIVATE_KEY,
    subject: e.VAPID_SUBJECT || "mailto:tkkwkut@gmail.com",
  };
}

/**
 * 人の端末すべてに知らせを送る。拡張はこれを呼ぶだけで、送り先を知らなくてよい。0023
 * 送り先が 404 か 410 を返したら消す。ほかの失敗は数え、5 回続いたら消す。
 *
 * @param db D1 を包んだ Drizzle
 * @param env Worker の環境変数
 * @param userIds 送る人
 * @returns 送れた端末の数
 */
export async function sendPush(db: DB, env: Env, userIds: string[], payload: PushPayload): Promise<number> {
  const keys = vapidKeys(env);
  if (!keys || userIds.length === 0) return 0;
  const targets = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, userIds));
  const body = JSON.stringify(payload);
  let sent = 0;
  for (const t of targets) {
    let status = 0;
    try {
      status = await sendWebPush(t, body, keys);
    } catch (e) {
      console.error("push", e);
    }
    if (status >= 200 && status < 300) {
      sent += 1;
      if (t.failedCount)
        await db.update(pushSubscriptions).set({ failedCount: 0 }).where(eq(pushSubscriptions.id, t.id));
    } else if (status === 404 || status === 410 || t.failedCount + 1 >= MAX_FAILURES) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, t.id));
    } else {
      await db
        .update(pushSubscriptions)
        .set({ failedCount: sql`${pushSubscriptions.failedCount} + 1` })
        .where(eq(pushSubscriptions.id, t.id));
    }
  }
  return sent;
}
