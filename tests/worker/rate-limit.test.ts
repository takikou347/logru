import { HttpError } from "@server/core/app";
import { enforceRateLimit } from "@server/core/rate-limit";
import { describe, expect, it, vi } from "vitest";

/** wrangler.jsonc の ratelimits 束縛を模す。0045 */
function fakeLimiter(success: boolean) {
  return { limit: vi.fn().mockResolvedValue({ success }) };
}

describe("利用者ごとの回数の上限。0045、#94", () => {
  it("束縛が無い環境では、数えずに素通りする", async () => {
    await expect(enforceRateLimit(undefined, "u1")).resolves.toBeUndefined();
  });

  it("上限の中なら、何も投げない", async () => {
    const limiter = fakeLimiter(true);
    await expect(enforceRateLimit(limiter as unknown as RateLimit, "u1")).resolves.toBeUndefined();
    expect(limiter.limit).toHaveBeenCalledWith({ key: "u1" });
  });

  it("上限を超えたら、少し待つよう促す 429 を投げる", async () => {
    const limiter = fakeLimiter(false);
    const error = await enforceRateLimit(limiter as unknown as RateLimit, "u1").catch((e) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(429);
    expect((error as HttpError).message).toBe("少し待ってから、もう一度試してください。");
  });

  it("利用者ごとに数える。key は利用者の ID で、IP は使わない", async () => {
    const limiter = fakeLimiter(true);
    await enforceRateLimit(limiter as unknown as RateLimit, "u2");
    expect(limiter.limit).toHaveBeenCalledTimes(1);
    expect(limiter.limit).toHaveBeenCalledWith({ key: "u2" });
  });
});
