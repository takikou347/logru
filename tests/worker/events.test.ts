import { occurrencesFor, toOccurrenceItem } from "@extensions/events/server/provider";
import {
  dayBeforeUtc,
  expandOccurrences,
  nextOccurrenceOnOrAfter,
  repeatRuleOf,
} from "@extensions/events/server/repeat";
import { repeatColumns } from "@extensions/events/server/routes";
import type { EventOccurrenceEditRow, EventRow } from "@extensions/events/server/schema";
import { eventDeleteInput, eventPatchInput, repeatRuleInput } from "@extensions/events/shared/schemas";
import { describe, expect, it } from "vitest";

const iso = (ms: number) => new Date(ms).toISOString();

/** 予定の表の行を、テストに要る分だけ作る */
function eventRow(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: "e1",
    groupId: "g1",
    createdBy: "kota",
    title: "元の題名",
    allDay: false,
    startsAt: new Date("2026-10-05T01:00:00.000Z"), // 日本時間 10 月 5 日 10 時、月曜
    endsAt: new Date("2026-10-05T02:00:00.000Z"),
    memo: null,
    repeatFreq: null,
    repeatDaysOfWeek: null,
    repeatUntil: null,
    repeatCount: null,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("expandOccurrences。F-36", () => {
  it("毎日は、土台の日付をそのまま進める", () => {
    const startsAt = new Date("2026-10-05T01:00:00.000Z");
    const rule = { freq: "daily" as const, daysOfWeek: null, until: null, count: null };
    const out = expandOccurrences(startsAt, rule, Date.UTC(2026, 9, 5), Date.UTC(2026, 9, 8));
    expect(out.map(iso)).toEqual(["2026-10-05T01:00:00.000Z", "2026-10-06T01:00:00.000Z", "2026-10-07T01:00:00.000Z"]);
  });

  it("毎週は、選んだ曜日を複数、早い順に開く", () => {
    // 10 月 5 日は月曜。月と木を選ぶ
    const startsAt = new Date("2026-10-05T01:00:00.000Z");
    const rule = { freq: "weekly" as const, daysOfWeek: [1, 4], until: null, count: null };
    const out = expandOccurrences(startsAt, rule, Date.UTC(2026, 9, 5), Date.UTC(2026, 9, 19));
    expect(out.map(iso)).toEqual([
      "2026-10-05T01:00:00.000Z", // 月
      "2026-10-08T01:00:00.000Z", // 木
      "2026-10-12T01:00:00.000Z", // 月
      "2026-10-15T01:00:00.000Z", // 木
    ]);
  });

  it("毎週の曜日は日本時間で数える。始まりが日本時間 9 時より前でも UTC の前日にずれない。0068", () => {
    // 2026-09-24 07:00 は日本時間で木曜。UTC では 1 時間早い暦の前日、水曜 22:00 になる
    const startsAt = new Date("2026-09-23T22:00:00.000Z");
    const rule = { freq: "weekly" as const, daysOfWeek: [4], until: null, count: null };
    const out = expandOccurrences(startsAt, rule, Date.UTC(2026, 8, 20), Date.UTC(2026, 9, 10));
    expect(out.map(iso)).toEqual([
      "2026-09-23T22:00:00.000Z", // 木、9/24 7:00 JST。始まり自身がその回に入る
      "2026-09-30T22:00:00.000Z", // 木、10/1 7:00 JST
      "2026-10-07T22:00:00.000Z", // 木、10/8 7:00 JST
    ]);
  });

  it("毎週の既定は、始まりの日の曜日だけ", () => {
    const startsAt = new Date("2026-10-05T01:00:00.000Z");
    const rule = { freq: "weekly" as const, daysOfWeek: null, until: null, count: null };
    const out = expandOccurrences(startsAt, rule, Date.UTC(2026, 9, 5), Date.UTC(2026, 9, 20));
    expect(out.map(iso)).toEqual(["2026-10-05T01:00:00.000Z", "2026-10-12T01:00:00.000Z", "2026-10-19T01:00:00.000Z"]);
  });

  it("毎月は、無い月をその回だけ飛ばす。1 月 31 日なら 2 月は出ない", () => {
    const startsAt = new Date("2026-01-31T00:00:00.000Z");
    const rule = { freq: "monthly" as const, daysOfWeek: null, until: null, count: null };
    const out = expandOccurrences(startsAt, rule, Date.UTC(2026, 0, 1), Date.UTC(2026, 3, 1));
    expect(out.map(iso)).toEqual(["2026-01-31T00:00:00.000Z", "2026-03-31T00:00:00.000Z"]);
  });

  it("毎年は、うるう年でない 2 月 29 日をその年だけ飛ばす", () => {
    const startsAt = new Date("2024-02-29T00:00:00.000Z"); // 2024 はうるう年
    const rule = { freq: "yearly" as const, daysOfWeek: null, until: null, count: null };
    const out = expandOccurrences(startsAt, rule, Date.UTC(2024, 0, 1), Date.UTC(2029, 0, 1));
    expect(out.map(iso)).toEqual(["2024-02-29T00:00:00.000Z", "2028-02-29T00:00:00.000Z"]);
  });

  it("毎月の日にちは日本時間で数える。始まりが日本時間 9 時より前でも UTC の前日にずれない。0068", () => {
    // 2026-11-01 07:00 は日本時間で 11 月 1 日。UTC では前日 10 月 31 日 22:00 になる
    const startsAt = new Date("2026-10-31T22:00:00.000Z");
    const rule = { freq: "monthly" as const, daysOfWeek: null, until: null, count: null };
    const out = expandOccurrences(startsAt, rule, Date.UTC(2026, 9, 1), Date.UTC(2027, 1, 15));
    expect(out.map(iso)).toEqual([
      "2026-10-31T22:00:00.000Z", // 11/1 7:00 JST。始まり自身がその回に入る
      "2026-11-30T22:00:00.000Z", // 12/1 7:00 JST。UTC の暦のままなら 11 月は無い日として飛ばされていた
      "2026-12-31T22:00:00.000Z", // 1/1 7:00 JST(2027)
      "2027-01-31T22:00:00.000Z", // 2/1 7:00 JST
    ]);
  });

  it("毎年の月日は日本時間で数える。始まりが日本時間 9 時より前でも UTC の前日にずれない。0068", () => {
    // 2027-01-01 07:00 は日本時間で 1 月 1 日。UTC では前年 12 月 31 日 22:00 になる
    const startsAt = new Date("2026-12-31T22:00:00.000Z");
    const rule = { freq: "yearly" as const, daysOfWeek: null, until: null, count: null };
    const out = expandOccurrences(startsAt, rule, Date.UTC(2026, 0, 1), Date.UTC(2030, 0, 1));
    expect(out.map(iso)).toEqual([
      "2026-12-31T22:00:00.000Z", // 2027/1/1 7:00 JST。始まり自身がその回に入る
      "2027-12-31T22:00:00.000Z", // 2028/1/1 7:00 JST
      "2028-12-31T22:00:00.000Z", // 2029/1/1 7:00 JST
      "2029-12-31T22:00:00.000Z", // 2030/1/1 7:00 JST
    ]);
  });

  it("終わりの日付までで打ち切る。その日は含む", () => {
    const startsAt = new Date("2026-10-05T01:00:00.000Z");
    const rule = { freq: "daily" as const, daysOfWeek: null, until: new Date(Date.UTC(2026, 9, 7)), count: null };
    const out = expandOccurrences(startsAt, rule, Date.UTC(2026, 9, 1), Date.UTC(2026, 9, 20));
    expect(out.map(iso)).toEqual(["2026-10-05T01:00:00.000Z", "2026-10-06T01:00:00.000Z", "2026-10-07T01:00:00.000Z"]);
  });

  it("終わりの回数までで打ち切る", () => {
    const startsAt = new Date("2026-10-05T01:00:00.000Z");
    const rule = { freq: "daily" as const, daysOfWeek: null, until: null, count: 2 };
    const out = expandOccurrences(startsAt, rule, Date.UTC(2026, 9, 1), Date.UTC(2026, 9, 20));
    expect(out.map(iso)).toEqual(["2026-10-05T01:00:00.000Z", "2026-10-06T01:00:00.000Z"]);
  });

  it("期間の外の回は返さない。to は含まない", () => {
    const startsAt = new Date("2026-10-05T01:00:00.000Z");
    const rule = { freq: "daily" as const, daysOfWeek: null, until: null, count: null };
    const out = expandOccurrences(startsAt, rule, Date.UTC(2026, 9, 6), Date.UTC(2026, 9, 7));
    expect(out.map(iso)).toEqual(["2026-10-06T01:00:00.000Z"]);
  });
});

describe("repeatRuleOf", () => {
  it("repeat_freq が空なら繰り返さない", () => {
    expect(repeatRuleOf(eventRow())).toBeNull();
  });

  it("repeat_freq があれば規則を返す", () => {
    const row = eventRow({ repeatFreq: "weekly", repeatDaysOfWeek: [1, 3], repeatCount: 5 });
    expect(repeatRuleOf(row)).toEqual({ freq: "weekly", daysOfWeek: [1, 3], until: null, count: 5 });
  });
});

describe("nextOccurrenceOnOrAfter。誕生日と記念日の近道。F-37", () => {
  const startsAt = new Date("2020-09-20T00:00:00.000Z");
  const rule = { freq: "yearly" as const, daysOfWeek: null, until: null, count: null };

  it("これから来る、いちばん早い回を返す", () => {
    expect(nextOccurrenceOnOrAfter(startsAt, rule, Date.UTC(2026, 8, 15))).toBe(Date.UTC(2026, 8, 20));
  });

  it("今日がその日なら、今日を返す", () => {
    expect(nextOccurrenceOnOrAfter(startsAt, rule, Date.UTC(2026, 8, 20))).toBe(Date.UTC(2026, 8, 20));
  });

  it("もう終わっていれば null", () => {
    const ended = { ...rule, count: 3 }; // 2020, 2021, 2022 の 3 回で終わる
    expect(nextOccurrenceOnOrAfter(startsAt, ended, Date.UTC(2026, 8, 1))).toBeNull();
  });
});

describe("dayBeforeUtc。これ以降の範囲で、いまの予定を終わらせる日。0043", () => {
  it("UTC のその日の前日の 0 時を返す", () => {
    expect(dayBeforeUtc(Date.UTC(2026, 9, 12, 1, 0)).toISOString()).toBe("2026-10-11T00:00:00.000Z");
  });

  it("月をまたぐ", () => {
    expect(dayBeforeUtc(Date.UTC(2026, 10, 1)).toISOString()).toBe("2026-10-31T00:00:00.000Z");
  });
});

describe("これ以降の範囲は、until をこの回の前日にすれば以降を含まない", () => {
  it("この回とそれより後を除き、前の回は残す", () => {
    const startsAt = new Date("2026-10-05T01:00:00.000Z");
    const rule = { freq: "weekly" as const, daysOfWeek: [1], until: null, count: null };
    const occurrenceAt = Date.UTC(2026, 9, 19); // 3 回目
    const truncated = { ...rule, until: dayBeforeUtc(occurrenceAt) };
    const out = expandOccurrences(startsAt, truncated, Date.UTC(2026, 9, 1), Date.UTC(2026, 10, 1));
    expect(out.map(iso)).toEqual(["2026-10-05T01:00:00.000Z", "2026-10-12T01:00:00.000Z"]);
  });
});

describe("occurrencesFor と toOccurrenceItem。この回だけの直し・取り消し。F-36", () => {
  const row = eventRow({ repeatFreq: "daily", repeatDaysOfWeek: null, repeatUntil: null, repeatCount: null });
  const from = Date.UTC(2026, 9, 1);
  const to = Date.UTC(2026, 9, 10);

  it("直しが無ければ、規則どおりの回をそのまま返す", () => {
    const out = occurrencesFor(row, undefined, from, to);
    expect(out).toHaveLength(5); // 10/5, 6, 7, 8, 9
    expect(out.every((o) => o.edit === undefined)).toBe(true);
  });

  it("この回だけの直しは、その回の項目だけを変える", () => {
    const edited: EventOccurrenceEditRow = {
      eventId: row.id,
      occurrenceAt: new Date(Date.UTC(2026, 9, 6, 1)),
      cancelled: false,
      startsAt: new Date(Date.UTC(2026, 9, 6, 4)), // 時刻をずらした
      endsAt: new Date(Date.UTC(2026, 9, 6, 5)),
      allDay: null,
      title: "直した題名",
      memo: null,
    };
    const edits = new Map([[edited.occurrenceAt.getTime(), edited]]);
    const out = occurrencesFor(row, edits, from, to);
    expect(out).toHaveLength(5);

    const items = out.map(({ occurrenceAt, edit }) => toOccurrenceItem(row, occurrenceAt, edit, [], "kota"));
    const changed = items.find((i) => i.occurrenceAt === Date.UTC(2026, 9, 6, 1))!;
    expect(changed.title).toBe("直した題名");
    expect(iso(changed.startsAt)).toBe("2026-10-06T04:00:00.000Z");
    expect(iso(changed.endsAt!)).toBe("2026-10-06T05:00:00.000Z");

    // ほかの回は規則どおり
    const untouched = items.find((i) => i.occurrenceAt === Date.UTC(2026, 9, 5, 1))!;
    expect(untouched.title).toBe("元の題名");
    expect(iso(untouched.startsAt)).toBe("2026-10-05T01:00:00.000Z");
    expect(iso(untouched.endsAt!)).toBe("2026-10-05T02:00:00.000Z");
  });

  it("取り消した回(cancelled)は出さない。ほかの回は残る", () => {
    const cancelledAt = Date.UTC(2026, 9, 7, 1);
    const cancelled: EventOccurrenceEditRow = {
      eventId: row.id,
      occurrenceAt: new Date(cancelledAt),
      cancelled: true,
      startsAt: null,
      endsAt: null,
      allDay: null,
      title: null,
      memo: null,
    };
    const edits = new Map([[cancelledAt, cancelled]]);
    const out = occurrencesFor(row, edits, from, to);
    expect(out).toHaveLength(4);
    expect(out.some((o) => o.occurrenceAt === cancelledAt)).toBe(false);
  });

  it("回の始まりを変えなければ、長さ(終わり - 始まり)を保つ", () => {
    const out = occurrencesFor(row, undefined, from, to);
    const item = toOccurrenceItem(row, out[0]!.occurrenceAt, out[0]!.edit, [], "kota");
    expect(item.endsAt! - item.startsAt).toBe(60 * 60 * 1000);
  });
});

describe("repeatColumns。入力を events の列にする。0043", () => {
  it("undefined なら列を触らない", () => {
    expect(repeatColumns(undefined)).toBeUndefined();
  });

  it("null なら繰り返しをやめる", () => {
    expect(repeatColumns(null)).toEqual({
      repeatFreq: null,
      repeatDaysOfWeek: null,
      repeatUntil: null,
      repeatCount: null,
    });
  });

  it("weekly 以外では daysOfWeek を持たない", () => {
    const out = repeatColumns({ freq: "daily", daysOfWeek: [1, 2] });
    expect(out?.repeatDaysOfWeek).toBeNull();
  });

  it("weekly では daysOfWeek をそのまま持つ", () => {
    const out = repeatColumns({ freq: "weekly", daysOfWeek: [2, 5] });
    expect(out?.repeatDaysOfWeek).toEqual([2, 5]);
  });

  it("until と count を、それぞれの列にする", () => {
    const until = Date.UTC(2027, 0, 1);
    expect(repeatColumns({ freq: "monthly", until })?.repeatUntil).toEqual(new Date(until));
    expect(repeatColumns({ freq: "monthly", count: 10 })?.repeatCount).toBe(10);
  });
});

describe("繰り返しの入力の検証", () => {
  it("終わりの日付と回数を同時には入れられない", () => {
    expect(repeatRuleInput.safeParse({ freq: "weekly", until: Date.now(), count: 3 }).success).toBe(false);
    expect(repeatRuleInput.safeParse({ freq: "weekly", until: Date.now() }).success).toBe(true);
  });

  it("回数は 1 から 999 まで", () => {
    expect(repeatRuleInput.safeParse({ freq: "daily", count: 0 }).success).toBe(false);
    expect(repeatRuleInput.safeParse({ freq: "daily", count: 1000 }).success).toBe(false);
    expect(repeatRuleInput.safeParse({ freq: "daily", count: 999 }).success).toBe(true);
  });
});

describe("直す・消すときの範囲(scope)の入力", () => {
  it("this、following、all のどれかを受け付ける", () => {
    for (const scope of ["this", "following", "all"]) {
      expect(eventPatchInput.safeParse({ scope, occurrenceAt: 1 }).success).toBe(true);
      expect(eventDeleteInput.safeParse({ scope, occurrenceAt: 1 }).success).toBe(true);
    }
  });

  it("scope も occurrenceAt も省ける。繰り返さない予定はこれで直せる", () => {
    expect(eventPatchInput.safeParse({ title: "直した" }).success).toBe(true);
    expect(eventDeleteInput.safeParse({}).success).toBe(true);
  });

  it("それ以外の文字は断る", () => {
    expect(eventDeleteInput.safeParse({ scope: "everything" }).success).toBe(false);
  });
});
