import { describe, expect, it } from "vitest";
import { addMonths, dateKey, dayTone, holidayName, monthGrid, onDay, parseDateKey, weekDays } from "../../src/client/lib/dates";

const d = (y: number, m: number, day: number, h = 0, min = 0) => new Date(y, m - 1, day, h, min);

describe("monthGrid", () => {
  it("日曜から始まり、土曜で終わる。2026 年 9 月は 5 週", () => {
    const days = monthGrid(d(2026, 9, 21));
    expect(days).toHaveLength(35);
    expect(dateKey(days[0]!)).toBe("2026-08-30");
    expect(dateKey(days[34]!)).toBe("2026-10-03");
    expect(days.every((x, i) => x.getDay() === i % 7)).toBe(true);
  });

  it("6 週にまたがる月もある", () => {
    // 2026 年 8 月は土曜に始まり、月曜に終わる
    expect(monthGrid(d(2026, 8, 1))).toHaveLength(42);
  });
});

describe("weekDays", () => {
  it("その週の日曜から土曜を返す", () => {
    const week = weekDays(d(2026, 9, 23));
    expect(week.map(dateKey)).toEqual([
      "2026-09-20",
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
    ]);
  });
});

describe("addMonths", () => {
  it("月末は、移った月の末日にそろえる", () => {
    expect(dateKey(addMonths(d(2026, 1, 31), 1))).toBe("2026-02-28");
    expect(dateKey(addMonths(d(2026, 3, 31), -1))).toBe("2026-02-28");
  });
});

describe("祝日と曜日の色", () => {
  it("2026 年のシルバーウィークを祝日として扱う", () => {
    expect(holidayName(d(2026, 9, 21))).toBe("敬老の日");
    expect(holidayName(d(2026, 9, 22))).toBe("休日");
    expect(holidayName(d(2026, 9, 23))).toBe("秋分の日");
    expect(holidayName(d(2026, 9, 24))).toBeNull();
  });

  it("日曜と祝日は朱、土曜は瑠璃", () => {
    expect(dayTone(d(2026, 9, 20))).toBe("sun");
    expect(dayTone(d(2026, 9, 21))).toBe("sun");
    expect(dayTone(d(2026, 9, 26))).toBe("sat");
    expect(dayTone(d(2026, 9, 24))).toBeNull();
  });
});

describe("parseDateKey", () => {
  it("正しい形だけを読む", () => {
    expect(dateKey(parseDateKey("2026-09-21")!)).toBe("2026-09-21");
    expect(parseDateKey("2026/09/21")).toBeNull();
    expect(parseDateKey("")).toBeNull();
  });
});

describe("onDay", () => {
  const at = (y: number, m: number, day: number, h = 0) => d(y, m, day, h).getTime();

  it("時刻のある予定は、始まりの日に出る", () => {
    const item = { startsAt: at(2026, 9, 21, 19), endsAt: at(2026, 9, 21, 21), allDay: false };
    expect(onDay(item, d(2026, 9, 21))).toBe(true);
    expect(onDay(item, d(2026, 9, 22))).toBe(false);
  });

  it("日をまたぐ予定は、両方の日に出る", () => {
    const item = { startsAt: at(2026, 9, 21, 23), endsAt: at(2026, 9, 22, 1), allDay: false };
    expect(onDay(item, d(2026, 9, 21))).toBe(true);
    expect(onDay(item, d(2026, 9, 22))).toBe(true);
  });

  it("終日の予定は、終わりの日の翌日 0 時の手前まで出る", () => {
    const item = { startsAt: at(2026, 9, 19), endsAt: at(2026, 9, 21), allDay: true };
    expect(onDay(item, d(2026, 9, 19))).toBe(true);
    expect(onDay(item, d(2026, 9, 20))).toBe(true);
    expect(onDay(item, d(2026, 9, 21))).toBe(false);
  });

  it("終わりの無い予定は、始まりの日だけに出る", () => {
    const item = { startsAt: at(2026, 9, 30, 18), endsAt: null, allDay: false };
    expect(onDay(item, d(2026, 9, 30))).toBe(true);
    expect(onDay(item, d(2026, 10, 1))).toBe(false);
  });
});
