import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getToday, subscribeToday, watchDayChange } from "@/lib/use-today";

describe("watchDayChange。今日を数える hook の確認。#301", () => {
  const listeners = new Map<string, () => void>();
  const doc = {
    visibilityState: "visible",
    addEventListener: (t: string, f: () => void) => listeners.set(t, f),
    removeEventListener: (t: string) => listeners.delete(t),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("document", doc);
    doc.visibilityState = "visible";
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    listeners.clear();
  });

  it("時計を進めると 60 秒ごとに確かめ、日付が変わったと分かる", () => {
    vi.setSystemTime(new Date(2026, 8, 23, 23, 59, 30));
    const day = () => new Date().getDate();
    let seen = day();
    const stop = watchDayChange(() => {
      seen = day();
    });
    expect(seen).toBe(23);
    vi.advanceTimersByTime(60_000);
    expect(seen).toBe(24);
    stop();
  });

  it("画面に戻ったとき、すぐ確かめる", () => {
    const check = vi.fn();
    const stop = watchDayChange(check);
    listeners.get("visibilitychange")?.();
    expect(check).toHaveBeenCalledTimes(1);
    doc.visibilityState = "hidden";
    listeners.get("visibilitychange")?.();
    expect(check).toHaveBeenCalledTimes(1);
    stop();
    expect(listeners.size).toBe(0);
  });

  it("日が変わると今日の値が切り替わり、購読者に知らせる。見張りは 1 本だけ", () => {
    vi.setSystemTime(new Date(2026, 8, 23, 23, 59, 30));
    const a = vi.fn();
    const b = vi.fn();
    const stopA = subscribeToday(a);
    const stopB = subscribeToday(b);
    const before = getToday();
    expect(before.getDate()).toBe(23);
    expect(getToday()).toBe(before);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(60_000);
    expect(getToday().getDate()).toBe(24);
    expect(getToday().getHours()).toBe(0);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    stopA();
    expect(vi.getTimerCount()).toBe(1);
    stopB();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("見張っていない間に日が変わっても、読むときに追いつく", () => {
    vi.setSystemTime(new Date(2026, 8, 24, 10, 0, 0));
    expect(getToday().getDate()).toBe(24);
    vi.setSystemTime(new Date(2026, 8, 25, 10, 0, 0));
    expect(getToday().getDate()).toBe(25);
  });
});
