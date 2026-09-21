import { describe, expect, it } from "vitest";
import { LOCK_MS, lockedUntil, recordFailure } from "../src/worker/lib/login-lock";

describe("recordFailure", () => {
  it("4 回目までは残りの回数を返す", () => {
    let state = recordFailure(undefined, 0);
    expect(state).toMatchObject({ count: 1, lockedUntil: null, remaining: 4 });
    state = recordFailure(state, 0);
    state = recordFailure(state, 0);
    state = recordFailure(state, 0);
    expect(state.remaining).toBe(1);
  });

  it("5 回目で 15 分締め出し、数を 0 に戻す", () => {
    const state = recordFailure({ count: 4, lockedUntil: null }, 1000);
    expect(state).toEqual({ count: 0, lockedUntil: 1000 + LOCK_MS, remaining: 0 });
  });

  it("締め出しが解けた後は 1 回目から数える", () => {
    const state = recordFailure({ count: 0, lockedUntil: 500 }, 1000);
    expect(state).toMatchObject({ count: 1, remaining: 4 });
  });
});

describe("lockedUntil", () => {
  it("解ける前なら時刻を返し、過ぎたら null を返す", () => {
    expect(lockedUntil({ count: 0, lockedUntil: 2000 }, 1000)).toBe(2000);
    expect(lockedUntil({ count: 0, lockedUntil: 2000 }, 2000)).toBeNull();
    expect(lockedUntil(undefined, 0)).toBeNull();
  });
});
