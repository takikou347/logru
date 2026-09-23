import { HttpError } from "@server/core/app";
import type { Context } from "hono";

/** 上限に当たったときの文言。「少し待ってから」のトーンで出す。0025、0045 */
const RATE_LIMIT_MESSAGE = "少し待ってから、もう一度試してください。";

/**
 * 送ってきた人の IP アドレス。ログイン前にも呼べる入り口で、利用者の ID の代わりに key にする。
 * Cloudflare が付ける CF-Connecting-IP を読むだけで、自分で確かめ直さない。0065、#161
 * @returns 無ければ "unknown"。手元の開発と E2E はいつもこれで、束縛も無いので数えない
 */
export function clientIp(c: Context): string {
  return c.req.header("CF-Connecting-IP") ?? "unknown";
}

/**
 * 利用者ごとの回数を数え、上限を超えていたら 429 を投げる。
 *
 * `limiter` は wrangler.jsonc の `ratelimits` の束縛。本番と staging にしか置いていないため、
 * 手元の開発と E2E では undefined になる。そのときは数えずに素通りさせる。0045
 *
 * @param limiter Env の RateLimit 束縛。無ければ何もしない
 * @param userId 数える人。key に使う。IP アドレスは使わない
 */
export async function enforceRateLimit(limiter: RateLimit | undefined, userId: string): Promise<void> {
  if (!limiter) return;
  const { success } = await limiter.limit({ key: userId });
  if (!success) throw new HttpError(429, RATE_LIMIT_MESSAGE);
}
