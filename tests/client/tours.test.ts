import type { Me } from "@shared/api-types";
import { tourIdParam } from "@shared/schemas";
import { addTourSeen, extensionTourId, MAX_TOURS_SEEN } from "@shared/tours";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fitsInViewport, shouldShowTour, tourController } from "../../src/client/lib/tours";

describe("コーチマークの進み方。閉じると保存される。F-33", () => {
  it("「分かった」で次へ進み、最後の 1 枚で保存する", () => {
    const save = vi.fn();
    const tour = tourController(3, save);
    tour.next();
    expect(tour.index).toBe(1);
    tour.next();
    expect(tour.index).toBe(2);
    expect(save).not.toHaveBeenCalled();
    tour.next();
    expect(tour.finished).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("「もう出さない」か外を押すと、途中でも保存して終わる", () => {
    const save = vi.fn();
    const tour = tourController(3, save);
    tour.next();
    tour.dismiss();
    expect(tour.finished).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("終わったあとに外を押しても、2 回は保存しない", () => {
    const save = vi.fn();
    const tour = tourController(1, save);
    tour.next();
    tour.dismiss();
    tour.next();
    expect(save).toHaveBeenCalledTimes(1);
  });
});

describe("案内を出す条件", () => {
  const me = (toursSeen: string[], onboardedAt: number | null = 1) =>
    ({ settings: { toursSeen }, onboardedAt }) as unknown as Me;
  // Vitest は .env.test を読むので、VITE_TOURS=off が入っている。ここでは外して確かめる
  beforeEach(() => vi.stubEnv("VITE_TOURS", ""));
  afterEach(() => vi.unstubAllEnvs());

  it("E2E テストのように VITE_TOURS=off なら出さない", () => {
    vi.stubEnv("VITE_TOURS", "off");
    expect(shouldShowTour(me([]), "calendar")).toBe(false);
  });

  it("見ていない画面にだけ出す", () => {
    expect(shouldShowTour(me([]), "calendar")).toBe(true);
    expect(shouldShowTour(me(["calendar"]), "calendar")).toBe(false);
    expect(shouldShowTour(me(["calendar"]), "group")).toBe(true);
  });

  it("はじめての案内が終わるまでは出さない", () => {
    expect(shouldShowTour(me([], null), "calendar")).toBe(false);
  });

  it("自分の情報を読めていなければ出さない", () => {
    expect(shouldShowTour(undefined, "calendar")).toBe(false);
  });
});

describe("指す場所が隠れているか", () => {
  it("下に浮かぶ帯に入る場所は、隠れているとみなす", () => {
    expect(fitsInViewport({ top: 100, bottom: 150 }, { height: 800 }, 110)).toBe(true);
    expect(fitsInViewport({ top: 700, bottom: 740 }, { height: 800 }, 110)).toBe(false);
    expect(fitsInViewport({ top: -10, bottom: 30 }, { height: 800 }, 0)).toBe(false);
  });
});

describe("見た画面の一覧", () => {
  it("同じ ID は 2 つ持たない", () => {
    expect(addTourSeen(["calendar"], "calendar")).toEqual(["calendar"]);
    expect(addTourSeen(["calendar"], "group")).toEqual(["calendar", "group"]);
  });

  it("上限を超えたら古いものから落とす", () => {
    const many = Array.from({ length: MAX_TOURS_SEEN }, (_, i) => `t${i}`);
    const next = addTourSeen(many, "new");
    expect(next).toHaveLength(MAX_TOURS_SEEN);
    expect(next[0]).toBe("t1");
    expect(next.at(-1)).toBe("new");
  });

  it("ID の形を確かめる。拡張の案内は ext.<key>", () => {
    expect(tourIdParam.safeParse({ id: "calendar" }).success).toBe(true);
    expect(tourIdParam.safeParse({ id: extensionTourId("memories") }).success).toBe(true);
    expect(tourIdParam.safeParse({ id: "Calendar" }).success).toBe(false);
    expect(tourIdParam.safeParse({ id: "a/b" }).success).toBe(false);
    expect(tourIdParam.safeParse({ id: "" }).success).toBe(false);
  });
});
