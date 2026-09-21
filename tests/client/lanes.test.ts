import { describe, expect, it } from "vitest";
import { dateKey } from "../../src/client/lib/dates";
import { daySpan, hiddenPerDay, isMultiDay, layoutWeek } from "../../src/client/modules/calendar/lanes";

const d = (y: number, m: number, day: number, h = 0, min = 0) => new Date(y, m - 1, day, h, min);

/** 終日の予定。終わりの日を含む */
const allDay = (title: string, from: Date, to: Date) => ({
  title,
  allDay: true,
  startsAt: from.getTime(),
  endsAt: new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1).getTime(),
});
const timed = (title: string, from: Date, to: Date | null) => ({
  title,
  allDay: false,
  startsAt: from.getTime(),
  endsAt: to ? to.getTime() : null,
});

/** 2026 年 9 月 20 日の日曜から始まる週 */
const WEEK = d(2026, 9, 20);

const brief = (r: ReturnType<typeof layoutWeek<{ title: string; allDay: boolean; startsAt: number; endsAt: number | null }>>) =>
  r.segments.map((s) => ({ title: s.item.title, col: s.col, span: s.span, lane: s.lane, before: s.before, after: s.after }));

describe("daySpan と isMultiDay", () => {
  it("終日の予定は、終わりの日の前の日までにかかる", () => {
    const { first, last } = daySpan(allDay("出張", d(2026, 9, 21), d(2026, 9, 25)));
    expect([dateKey(first), dateKey(last)]).toEqual(["2026-09-21", "2026-09-25"]);
  });

  it("1 日だけの終日の予定や、終わりの無い予定は、何日も続かない", () => {
    expect(isMultiDay(allDay("休み", d(2026, 9, 21), d(2026, 9, 21)))).toBe(false);
    expect(isMultiDay(timed("電話", d(2026, 9, 21, 9), null))).toBe(false);
  });

  it("時刻のある予定は、日をまたぐときだけ何日も続く。0 時ちょうどに終わるものはまたがない", () => {
    expect(isMultiDay(timed("夜行バス", d(2026, 9, 10, 22), d(2026, 9, 11, 6)))).toBe(true);
    expect(isMultiDay(timed("残業", d(2026, 9, 10, 20), d(2026, 9, 11, 0)))).toBe(false);
  });
});

describe("layoutWeek", () => {
  it("週の中に収まる予定は、1 本の帯になる", () => {
    const r = layoutWeek([allDay("出張", d(2026, 9, 21), d(2026, 9, 25))], WEEK);
    expect(r.lanes).toBe(1);
    expect(brief(r)).toEqual([{ title: "出張", col: 1, span: 5, lane: 0, before: false, after: false }]);
  });

  it("週をまたぐ予定は、週の終わりで切り、次の週の頭から続ける", () => {
    const trip = allDay("旅行", d(2026, 9, 26), d(2026, 9, 28));
    expect(brief(layoutWeek([trip], WEEK))).toEqual([{ title: "旅行", col: 6, span: 1, lane: 0, before: false, after: true }]);
    expect(brief(layoutWeek([trip], d(2026, 9, 27)))).toEqual([{ title: "旅行", col: 0, span: 2, lane: 0, before: true, after: false }]);
  });

  it("3 週にかかる予定は、真ん中の週では 7 日ぶん伸び、両側に続く", () => {
    const long = allDay("長い休み", d(2026, 9, 17), d(2026, 10, 1));
    expect(brief(layoutWeek([long], WEEK))).toEqual([{ title: "長い休み", col: 0, span: 7, lane: 0, before: true, after: true }]);
  });

  it("週にかからない予定は、帯を作らない", () => {
    const r = layoutWeek([allDay("先週", d(2026, 9, 14), d(2026, 9, 19)), allDay("来週", d(2026, 9, 27), d(2026, 9, 29))], WEEK);
    expect(r).toEqual({ segments: [], lanes: 0 });
  });

  it("重なる帯は段を分ける。始まりが早い順、同じなら長い順に上から入れる", () => {
    const r = layoutWeek(
      [
        allDay("展示会", d(2026, 9, 23), d(2026, 9, 24)),
        allDay("研修", d(2026, 9, 21), d(2026, 9, 22)),
        allDay("出張", d(2026, 9, 21), d(2026, 9, 25)),
      ],
      WEEK,
    );
    expect(r.lanes).toBe(2);
    expect(brief(r).map((s) => [s.title, s.lane])).toEqual([
      ["出張", 0],
      ["研修", 1],
      ["展示会", 1],
    ]);
  });

  it("空いた段には、後の帯が詰めて入る", () => {
    const r = layoutWeek(
      [allDay("前半", d(2026, 9, 20), d(2026, 9, 22)), allDay("後半", d(2026, 9, 23), d(2026, 9, 26))],
      WEEK,
    );
    expect(r.lanes).toBe(1);
    expect(brief(r).map((s) => s.lane)).toEqual([0, 0]);
  });

  it("前の週から続く帯は、その週に始まる帯より上に入る", () => {
    const r = layoutWeek([allDay("今週から", d(2026, 9, 20), d(2026, 9, 26)), allDay("先週から", d(2026, 9, 18), d(2026, 9, 21))], WEEK);
    expect(brief(r).map((s) => [s.title, s.lane])).toEqual([
      ["先週から", 0],
      ["今週から", 1],
    ]);
  });

  it("月をまたぐ予定も、表に並ぶ週の中で切って続ける", () => {
    // 2026 年 9 月の表の最後の週は、9 月 27 日から 10 月 3 日
    const home = allDay("帰省", d(2026, 9, 30), d(2026, 10, 5));
    expect(brief(layoutWeek([home], d(2026, 9, 27)))).toEqual([{ title: "帰省", col: 3, span: 4, lane: 0, before: false, after: true }]);
    // 10 月の表の 2 週目の頭から続く
    expect(brief(layoutWeek([home], d(2026, 10, 4)))).toEqual([{ title: "帰省", col: 0, span: 2, lane: 0, before: true, after: false }]);
  });

  it("日をまたぐ時刻のある予定は、かかる日だけの帯になる", () => {
    const bus = timed("夜行バス", d(2026, 9, 26, 22), d(2026, 9, 27, 6));
    expect(brief(layoutWeek([bus], WEEK))).toEqual([{ title: "夜行バス", col: 6, span: 1, lane: 0, before: false, after: true }]);
  });
});

describe("hiddenPerDay", () => {
  it("出しきれない段の帯を、かかる曜日ごとに数える", () => {
    const r = layoutWeek(
      [
        allDay("一", d(2026, 9, 21), d(2026, 9, 25)),
        allDay("二", d(2026, 9, 22), d(2026, 9, 24)),
        allDay("三", d(2026, 9, 23), d(2026, 9, 26)),
      ],
      WEEK,
    );
    expect(r.lanes).toBe(3);
    expect(hiddenPerDay(r.segments, 2)).toEqual([0, 0, 0, 1, 1, 1, 1]);
    expect(hiddenPerDay(r.segments, 3)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});
