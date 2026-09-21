import { describe, expect, it } from "vitest";
import { decryptText, encryptText } from "../../src/extensions/external-calendars/server/crypto";
import { parseIcs, wallTimeToUtc } from "../../src/extensions/external-calendars/server/ics";
import { fetchIcs, normalizeCalendarUrl } from "../../src/extensions/external-calendars/server/sync";
import allDay from "./fixtures/all-day.ics?raw";
import oldRecurring from "./fixtures/old-recurring.ics?raw";
import single from "./fixtures/single.ics?raw";
import timezone from "./fixtures/timezone.ics?raw";
import weekly from "./fixtures/weekly.ics?raw";

const window = { from: Date.UTC(2026, 8, 1), to: Date.UTC(2027, 2, 1) };
const iso = (ms: number | null) => (ms == null ? null : new Date(ms).toISOString());

describe("parseIcs", () => {
  it("1 回だけの予定を読み、取り消したものと期間の外のものを除く", () => {
    const events = parseIcs(single, window);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ uid: "single-1@test", title: "Dentist", location: "Shibuya, Tokyo", allDay: false });
    expect(iso(events[0]!.startsAt)).toBe("2026-10-15T01:00:00.000Z");
    expect(iso(events[0]!.endsAt)).toBe("2026-10-15T02:00:00.000Z");
  });

  it("終日の予定は、日本時間の 0 時から、終わりの日の翌日の 0 時までにする", () => {
    const [trip, noEnd] = parseIcs(allDay, window);
    expect(trip).toMatchObject({ title: "Trip", allDay: true });
    expect(iso(trip!.startsAt)).toBe("2026-10-19T15:00:00.000Z");
    expect(iso(trip!.endsAt)).toBe("2026-10-22T15:00:00.000Z");
    // 終わりが無い終日の予定は 1 日にする
    expect(iso(noEnd!.startsAt)).toBe("2026-11-02T15:00:00.000Z");
    expect(iso(noEnd!.endsAt)).toBe("2026-11-03T15:00:00.000Z");
  });

  it("毎週の繰り返しを開き、EXDATE の回を抜き、直した回を反映する", () => {
    const events = parseIcs(weekly, window).sort((a, b) => a.startsAt - b.startsAt);
    expect(events.map((e) => iso(e.startsAt))).toEqual([
      "2026-10-05T10:00:00.000Z",
      "2026-10-12T12:00:00.000Z",
      "2026-10-26T10:00:00.000Z",
      "2026-11-02T10:00:00.000Z",
    ]);
    const moved = events[1]!;
    expect(moved.title).toBe("Book club (late)");
    // 何回目かは、元の始まりの時刻で数える
    expect(iso(moved.occurrence)).toBe("2026-10-12T10:00:00.000Z");
    expect(new Set(events.map((e) => `${e.uid}:${e.occurrence}`)).size).toBe(4);
  });

  it("繰り返しは期間の中の回だけを返す", () => {
    const events = parseIcs(weekly, { from: Date.UTC(2026, 9, 20), to: Date.UTC(2026, 9, 30) });
    expect(events.map((e) => iso(e.startsAt))).toEqual(["2026-10-26T10:00:00.000Z"]);
  });

  it("何年も前から続く繰り返しも、期間の中の回を正しく返す", () => {
    const events = parseIcs(oldRecurring, { from: Date.UTC(2026, 9, 1), to: Date.UTC(2026, 9, 15) });
    const of = (uid: string) => events.filter((e) => e.uid === uid).map((e) => iso(e.startsAt)).sort();
    // 月曜と木曜。10 月 8 日は EXDATE で抜く
    expect(of("old-weekly@test")).toEqual(["2026-10-01T00:00:00.000Z", "2026-10-05T00:00:00.000Z", "2026-10-12T00:00:00.000Z"]);
    // 2020 年 1 月 1 日から 3 日おき
    expect(of("old-daily@test")).toEqual(
      ["2026-10-02", "2026-10-05", "2026-10-08", "2026-10-11", "2026-10-14"].map((d) => `${d}T03:00:00.000Z`),
    );
  });

  it("TZID の時間帯で読み、夏時間を反映する。時間帯の無い時刻は日本時間で読む", () => {
    const byUid = Object.fromEntries(parseIcs(timezone, window).map((e) => [e.uid, e]));
    expect(iso(byUid["ny-1@test"]!.startsAt)).toBe("2026-10-30T13:00:00.000Z");
    expect(iso(byUid["ny-2@test"]!.startsAt)).toBe("2026-11-05T14:00:00.000Z");
    expect(iso(byUid["floating-1@test"]!.startsAt)).toBe("2026-11-06T00:00:00.000Z");
  });

  it("iCal でない文字列は失敗にする", () => {
    expect(() => parseIcs("<html>not found</html>", window)).toThrow();
  });
});

describe("wallTimeToUtc", () => {
  it("時間帯の壁の時計を UTC にする", () => {
    expect(iso(wallTimeToUtc(2026, 1, 1, 0, 0, 0, "Asia/Tokyo"))).toBe("2025-12-31T15:00:00.000Z");
    expect(wallTimeToUtc(2026, 1, 1, 0, 0, 0, "Not/AZone")).toBeNull();
  });
});

describe("encryptText", () => {
  const key = btoa(String.fromCharCode(...new Uint8Array(32).map((_, i) => i)));

  it("暗号にしたものを同じ鍵で戻せる。毎回ちがう形になる", async () => {
    const url = "https://calendar.google.com/calendar/ical/abc%40group.calendar.google.com/private-xyz/basic.ics";
    const a = await encryptText(url, key);
    const b = await encryptText(url, key);
    expect(a).not.toBe(b);
    expect(a).not.toContain("google");
    expect(await decryptText(a, key)).toBe(url);
  });

  it("違う鍵では戻せない", async () => {
    const other = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
    const sealed = await encryptText("secret", key);
    await expect(decryptText(sealed, other)).rejects.toThrow();
  });

  it("鍵が無いか 32 バイトでなければ失敗にする", async () => {
    await expect(encryptText("x", undefined)).rejects.toThrow(/EXTERNAL_CALENDAR_KEY/);
    await expect(encryptText("x", btoa("short"))).rejects.toThrow(/32 バイト/);
  });
});

describe("normalizeCalendarUrl", () => {
  it("https と webcal を受け付け、webcal は https に直す", () => {
    expect(normalizeCalendarUrl("https://calendar.google.com/a.ics", false).toString()).toBe("https://calendar.google.com/a.ics");
    expect(normalizeCalendarUrl("webcal://example.com/a.ics", false).protocol).toBe("https:");
  });

  it("http は、手元の開発の localhost だけを受け付ける", () => {
    expect(() => normalizeCalendarUrl("http://example.com/a.ics", true)).toThrow(/https/);
    expect(() => normalizeCalendarUrl("http://localhost:4173/a.ics", false)).toThrow(/https/);
    expect(normalizeCalendarUrl("http://localhost:4173/a.ics", true).host).toBe("localhost:4173");
  });

  it("URL でないものと、パスワードの入った URL を断る", () => {
    expect(() => normalizeCalendarUrl("calendar", false)).toThrow(/URL/);
    expect(() => normalizeCalendarUrl("https://a:b@example.com/a.ics", false)).toThrow(/パスワード/);
  });
});

describe("fetchIcs", () => {
  const url = new URL("https://example.com/a.ics");

  it("大きすぎるものは読まない", async () => {
    const big = new Uint8Array(6 * 1024 * 1024);
    const fetcher = (async () => new Response(big)) as unknown as typeof fetch;
    await expect(fetchIcs(url, fetcher)).rejects.toThrow(/大きすぎ/);
  });

  it("見つからないときは、URL を確かめるよう伝える", async () => {
    const fetcher = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;
    await expect(fetchIcs(url, fetcher)).rejects.toThrow(/見つかりません/);
  });

  it("読めたら文字列を返す", async () => {
    const fetcher = (async () => new Response(single)) as unknown as typeof fetch;
    expect(await fetchIcs(url, fetcher)).toContain("BEGIN:VCALENDAR");
  });
});
