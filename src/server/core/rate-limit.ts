import { HttpError } from "@server/core/app";

/** 上限に当たったときの文言。「少し待ってから」のトーンで出す。0025、0045 */
const RATE_LIMIT_MESSAGE = "少し待ってから、もう一度試してください。";

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
