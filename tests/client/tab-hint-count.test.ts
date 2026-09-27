import { describe, expect, it } from "vitest";
import { MAX_HINT_TIMES, nextTabHintCount, shouldShowTabHint } from "@/lib/tab-hint-count";

describe("shouldShowTabHint", () => {
  it("はじめの 3 回(0, 1, 2 回目)は名前を出す", () => {
    expect(shouldShowTabHint(0)).toBe(true);
    expect(shouldShowTabHint(1)).toBe(true);
    expect(shouldShowTabHint(2)).toBe(true);
  });

  it("4 回目(3 回済んでいる)からは出さない", () => {
    expect(shouldShowTabHint(MAX_HINT_TIMES)).toBe(false);
    expect(shouldShowTabHint(MAX_HINT_TIMES + 1)).toBe(false);
  });
});

describe("nextTabHintCount", () => {
  it("3 回に達するまでは 1 増える", () => {
    expect(nextTabHintCount(0)).toBe(1);
    expect(nextTabHintCount(1)).toBe(2);
    expect(nextTabHintCount(2)).toBe(3);
  });

  it("3 回に達したら、それ以上は数え続けない", () => {
    expect(nextTabHintCount(3)).toBe(3);
    expect(nextTabHintCount(10)).toBe(10);
  });
});
