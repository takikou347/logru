/** 1 年をらせんで見る画面の、three.js に依存しない部分。0051 */

import { describe, expect, it } from "vitest";
import type { ViewItem } from "@/modules/calendar/model";
import { indexOfDay, spiralPoint } from "@/modules/calendar/spiral/geometry";
import { pochiProgress } from "@/modules/calendar/spiral/pochi";
import { summarizeDays } from "@/modules/calendar/spiral/summarize";
import { supportsWebGL } from "@/modules/calendar/spiral/support";
import { daysInYear, yearChunks } from "@/modules/calendar/spiral/year-range";

describe("daysInYear", () => {
  it("うるう年でない年は 365 日", () => {
    expect(daysInYear(2026)).toHaveLength(365);
    expect(daysInYear(2026)[0]).toEqual(new Date(2026, 0, 1));
    expect(daysInYear(2026).at(-1)).toEqual(new Date(2026, 11, 31));
  });

  it("うるう年は 366 日", () => {
    expect(daysInYear(2028)).toHaveLength(366);
  });
});

describe("yearChunks", () => {
  it("100 日の上限に収まる期間に分け、年全体を隙間なく覆う", () => {
    const MAX_RANGE_MS = 100 * 24 * 60 * 60 * 1000;
    const chunks = yearChunks(2026);
    expect(chunks[0]!.from).toBe(new Date(2026, 0, 1).getTime());
    expect(chunks.at(-1)!.to).toBe(new Date(2027, 0, 1).getTime());
    for (const c of chunks) expect(c.to - c.from).toBeLessThanOrEqual(MAX_RANGE_MS);
    for (let i = 1; i < chunks.length; i++) expect(chunks[i]!.from).toBe(chunks[i - 1]!.to);
  });

  it("うるう年でも上限に収まる", () => {
    const MAX_RANGE_MS = 100 * 24 * 60 * 60 * 1000;
    for (const c of yearChunks(2028)) expect(c.to - c.from).toBeLessThanOrEqual(MAX_RANGE_MS);
  });
});

describe("spiralPoint", () => {
  it("1 月 1 日は角度 0、高さの下端", () => {
    const p = spiralPoint(0, 365, 3, 8);
    expect(p.angle).toBe(0);
    expect(p.x).toBeCloseTo(3);
    expect(p.z).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(-4);
  });

  it("半径は年を通して変わらない", () => {
    for (const i of [0, 100, 200, 364]) {
      const p = spiralPoint(i, 365, 3, 8);
      expect(Math.hypot(p.x, p.z)).toBeCloseTo(3);
    }
  });

  it("日の番号が増えるほど、高さも増える", () => {
    const a = spiralPoint(10, 365, 3, 8);
    const b = spiralPoint(200, 365, 3, 8);
    expect(b.y).toBeGreaterThan(a.y);
  });
});

describe("indexOfDay", () => {
  const days = daysInYear(2026);

  it("年の最初の日は 0", () => {
    expect(indexOfDay(days, new Date(2026, 0, 1))).toBe(0);
  });

  it("年の最後の日は総日数 - 1", () => {
    expect(indexOfDay(days, new Date(2026, 11, 31))).toBe(days.length - 1);
  });

  it("年に含まれない日は null", () => {
    expect(indexOfDay(days, new Date(2027, 0, 1))).toBeNull();
  });

  it("時刻が違っても同じ日なら同じ番号(ぽつが止まる位置と、日の点の位置がずれない)", () => {
    const target = new Date(2026, 5, 15, 23, 59);
    const idx = indexOfDay(days, target);
    expect(idx).not.toBeNull();
    const fromDots = spiralPoint(
      days.findIndex((d) => d.getTime() === new Date(2026, 5, 15).getTime()),
      365,
      3,
      8,
    );
    const fromPochi = spiralPoint(idx as number, 365, 3, 8);
    expect(fromPochi).toEqual(fromDots);
  });
});

describe("pochiProgress", () => {
  it("動きを減らす設定では、経過に関わらずいつも 1(今日の位置)", () => {
    expect(pochiProgress(0, true)).toBe(1);
    expect(pochiProgress(999999, true)).toBe(1);
  });

  it("始まりは 0、転がり切ると 1", () => {
    expect(pochiProgress(0, false)).toBe(0);
    expect(pochiProgress(100000, false)).toBe(1);
  });

  it("経過とともに進む。負や 1 を超える経過でもはみ出さない", () => {
    const early = pochiProgress(200, false);
    const late = pochiProgress(1800, false);
    expect(early).toBeGreaterThan(0);
    expect(late).toBeGreaterThan(early);
    expect(late).toBeLessThanOrEqual(1);
    expect(pochiProgress(-100, false)).toBe(0);
  });
});

describe("supportsWebGL", () => {
  it("context を取れなければ false", () => {
    expect(supportsWebGL(() => ({ getContext: () => null }))).toBe(false);
  });

  it("webgl2 の context を取れれば true", () => {
    expect(supportsWebGL(() => ({ getContext: (id) => (id === "webgl2" ? {} : null) }))).toBe(true);
  });

  it("getContext が投げても false", () => {
    expect(
      supportsWebGL(() => ({
        getContext: () => {
          throw new Error("no gpu");
        },
      })),
    ).toBe(false);
  });
});

describe("summarizeDays", () => {
  const day1 = new Date(2026, 0, 1);
  const day2 = new Date(2026, 0, 2);
  const base: Omit<ViewItem, "startsAt" | "endsAt" | "allDay" | "secondary" | "thumb" | "color"> = {
    extension: "events",
    id: "e1",
    groupId: "g1",
    createdBy: "u1",
    title: "予定",
    groupName: "自分だけ",
    creatorName: null,
    creatorColor: null,
    people: [],
  };

  it("secondary でない項目の色を、その日の点の色にする", () => {
    const item: ViewItem = {
      ...base,
      startsAt: day1.getTime(),
      endsAt: null,
      allDay: false,
      color: "wakatake",
    };
    const [d1, d2] = summarizeDays([day1, day2], [item]);
    expect(d1!.color).toBe("wakatake");
    expect(d2!.color).toBeNull();
  });

  it("secondary な項目の色は使わないが、thumb は使う", () => {
    const item: ViewItem = {
      ...base,
      id: "r1",
      startsAt: day1.getTime(),
      endsAt: day1.getTime() + 24 * 60 * 60 * 1000,
      allDay: true,
      secondary: true,
      color: "nezumi",
      thumb: "data:image/jpeg;base64,abc",
    };
    const [d1] = summarizeDays([day1], [item]);
    expect(d1!.color).toBeNull();
    expect(d1!.thumb).toBe("data:image/jpeg;base64,abc");
  });

  it("その日に項目が無ければ、色も写真も null", () => {
    const [d1] = summarizeDays([day1], []);
    expect(d1!.color).toBeNull();
    expect(d1!.thumb).toBeNull();
  });
});
