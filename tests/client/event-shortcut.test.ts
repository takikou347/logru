import { daysUntilLabel } from "@extensions/events/client/shortcut";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("daysUntilLabel。誕生日と記念日の近道。F-37", () => {
  beforeEach(() => {
    // 2026-09-23 の 18 時に固定する。時刻を含んだまま日数を引くと、日をまたぐ前は 1 日多く数えてしまう
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 23, 18, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("今日の、今より前の時刻でも「今日」", () => {
    expect(daysUntilLabel(new Date(2026, 8, 23, 9, 0).getTime())).toBe("今日");
  });

  it("今日の、今より後の時刻でも「今日」", () => {
    expect(daysUntilLabel(new Date(2026, 8, 23, 23, 0).getTime())).toBe("今日");
  });

  it("翌日の早い時刻でも「明日」", () => {
    expect(daysUntilLabel(new Date(2026, 8, 24, 0, 30).getTime())).toBe("明日");
  });

  it("2 日以上先は「あと N 日」", () => {
    expect(daysUntilLabel(new Date(2026, 8, 30, 0, 0).getTime())).toBe("あと7日");
  });
});
