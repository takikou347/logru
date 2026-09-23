import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markJustAdded, takeJustAdded } from "../../src/client/modules/calendar/recent-items";

describe("recent-items。足したチップが膨らんで入る動きの対象を覚える。#98", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("覚えていない項目は false", () => {
    expect(takeJustAdded("events:no-such-id")).toBe(false);
  });

  it("足した直後は true。読むと覚えを消すので、2 度目は false", () => {
    markJustAdded("events:1");
    expect(takeJustAdded("events:1")).toBe(true);
    expect(takeJustAdded("events:1")).toBe(false);
  });

  it("時間が経つと、読む前でも false になる", () => {
    markJustAdded("events:2");
    vi.advanceTimersByTime(3_001);
    expect(takeJustAdded("events:2")).toBe(false);
  });
});
