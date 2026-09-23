import { expiryFor, isJpeg, PhotoSigner, photoKey, verifyPhotoUrl } from "@extensions/memories/server/photos";
import { addDaysToKey, dayIndexOf, dayKeyIn, hourIn, memoryDays, startOfDayIn } from "@extensions/memories/shared/days";
import { memoryInput, PHOTO_DATA_URL_PATTERN, recordInput } from "@extensions/memories/shared/schemas";
import { describe, expect, it } from "vitest";

describe("思い出の日付", () => {
  it("時間帯での 0 時を UTC で返す", () => {
    expect(new Date(startOfDayIn("2026-09-19", "Asia/Tokyo")).toISOString()).toBe("2026-09-18T15:00:00.000Z");
    expect(new Date(startOfDayIn("2026-03-08", "America/New_York")).toISOString()).toBe("2026-03-08T05:00:00.000Z");
  });

  it("その時間帯での日付と時を返す", () => {
    const t = Date.parse("2026-09-19T16:30:00Z");
    expect(dayKeyIn(t, "Asia/Tokyo")).toBe("2026-09-20");
    expect(hourIn(t, "Asia/Tokyo")).toBe(1);
  });

  it("月をまたいで日数を足す", () => {
    expect(addDaysToKey("2026-09-30", 1)).toBe("2026-10-01");
  });

  const memory = {
    startsAt: startOfDayIn("2026-09-19", "Asia/Tokyo"),
    endsAt: startOfDayIn("2026-09-21", "Asia/Tokyo"),
    timeZone: "Asia/Tokyo",
  };

  it("思い出の日を並べる", () => {
    expect(memoryDays(memory)).toEqual(["2026-09-19", "2026-09-20"]);
  });

  it("期間の外の記録は、いちばん近い日に入る。0020", () => {
    expect(dayIndexOf(Date.parse("2026-09-20T03:00:00Z"), memory)).toBe(1);
    expect(dayIndexOf(Date.parse("2026-09-25T03:00:00Z"), memory)).toBe(1);
    expect(dayIndexOf(Date.parse("2026-09-01T03:00:00Z"), memory)).toBe(0);
  });
});

describe("思い出の入力", () => {
  const base = {
    groupId: "g",
    title: "箱根 1 泊",
    firstDay: "2026-09-19",
    lastDay: "2026-09-20",
    timeZone: "Asia/Tokyo",
  };

  it("32 日以上と、終わりが始まりより前は断る。F-101", () => {
    expect(memoryInput.safeParse(base).success).toBe(true);
    expect(memoryInput.safeParse({ ...base, lastDay: "2026-10-20" }).success).toBe(false);
    expect(memoryInput.safeParse({ ...base, lastDay: "2026-09-18" }).success).toBe(false);
    expect(memoryInput.safeParse({ ...base, title: " " }).success).toBe(false);
  });

  it("知らない時間帯は断る", () => {
    expect(memoryInput.safeParse({ ...base, timeZone: "Mars/Olympus" }).success).toBe(false);
  });

  it("記録は文章か写真のどちらかが要る。F-111", () => {
    expect(recordInput.safeParse({ groupId: "g" }).success).toBe(false);
    expect(recordInput.safeParse({ groupId: "g", body: "湯本に着いた" }).success).toBe(true);
    expect(recordInput.safeParse({ groupId: "g", photoIds: ["p"] }).success).toBe(true);
  });
});

describe("写真の URL", () => {
  const secret = "test-secret";
  const now = Date.parse("2026-09-22T10:00:00Z");

  it("期限は協定世界時で翌日の終わり", () => {
    expect(new Date(expiryFor(now)).toISOString()).toBe("2026-09-23T23:59:59.999Z");
  });

  it("署名が合い、期限の中なら通す。F-124", async () => {
    const url = await new PhotoSigner(secret, now).url("p1", "thumb");
    const q = new URL(url, "https://logru.test").searchParams;
    expect(url.startsWith("/api/memories/photos/p1/thumb?")).toBe(true);
    expect(await verifyPhotoUrl(secret, "p1", "thumb", Number(q.get("e")), q.get("s")!, now)).toBe(true);
  });

  it("別の写真、別の大きさ、期限切れ、別の鍵は断る", async () => {
    const url = await new PhotoSigner(secret, now).url("p1", "thumb");
    const q = new URL(url, "https://logru.test").searchParams;
    const e = Number(q.get("e"));
    const s = q.get("s")!;
    expect(await verifyPhotoUrl(secret, "p2", "thumb", e, s, now)).toBe(false);
    expect(await verifyPhotoUrl(secret, "p1", "full", e, s, now)).toBe(false);
    expect(await verifyPhotoUrl(secret, "p1", "thumb", e, s, e + 1)).toBe(false);
    expect(await verifyPhotoUrl("other", "p1", "thumb", e, s, now)).toBe(false);
    expect(await verifyPhotoUrl(secret, "p1", "thumb", e, "!!", now)).toBe(false);
  });

  it("R2 の鍵と、JPEG の見分け", () => {
    expect(photoKey("p", "full")).toBe("m/p.jpg");
    expect(photoKey("p", "thumb")).toBe("m/p_t.jpg");
    expect(isJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(isJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
  });

  it("tiny は data URL の全体を確かめる。頭だけの一致では通さない。0065、#161", () => {
    expect(PHOTO_DATA_URL_PATTERN.test("data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==")).toBe(true);
    expect(PHOTO_DATA_URL_PATTERN.test("data:image/jpeg;base64,")).toBe(false);
    expect(PHOTO_DATA_URL_PATTERN.test("data:image/jpeg;base64,ok<script>")).toBe(false);
    expect(PHOTO_DATA_URL_PATTERN.test("data:image/png;base64,iVBORw0KGgo=")).toBe(false);
  });
});

import { hourStartIn, openSlots, slotAt, slotsOfDay } from "@extensions/memories/shared/koma";

describe("ひとコマの枠。0022", () => {
  const tz = "Asia/Tokyo";
  it("7 時台から 22 時台の外は枠が無い", () => {
    expect(slotAt(Date.parse("2026-09-22T06:59:00+09:00"), tz)).toBeNull();
    expect(slotAt(Date.parse("2026-09-22T23:00:00+09:00"), tz)).toBeNull();
    expect(slotAt(Date.parse("2026-09-22T14:37:12+09:00"), tz)).toEqual({
      start: Date.parse("2026-09-22T14:00:00+09:00"),
      hour: 14,
      day: "2026-09-22",
    });
  });

  it("過ぎてから 5 分は、前の枠にも残せる", () => {
    expect(openSlots(Date.parse("2026-09-22T15:03:00+09:00"), tz).map((s) => s.hour)).toEqual([15, 14]);
    expect(openSlots(Date.parse("2026-09-22T15:06:00+09:00"), tz).map((s) => s.hour)).toEqual([15]);
    expect(openSlots(Date.parse("2026-09-22T23:02:00+09:00"), tz).map((s) => s.hour)).toEqual([22]);
  });

  it("30 分ずれた時間帯でも、1 時間の始まりに合う", () => {
    expect(new Date(hourStartIn(Date.parse("2026-09-22T10:10:00Z"), "Asia/Kolkata")).toISOString()).toBe(
      "2026-09-22T09:30:00.000Z",
    );
  });

  it("1 日の枠は 16 個", () => {
    const slots = slotsOfDay(Date.parse("2026-09-22T00:00:00+09:00"), tz);
    expect(slots.map((s) => s.hour)).toEqual([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
  });
});

import { memoryOfEvent } from "@extensions/memories/shared/links";

describe("予定がどの思い出に入るか。0020", () => {
  const day = (d: number) => Date.parse(`2026-09-${String(d).padStart(2, "0")}T00:00:00+09:00`);
  const trip = { id: "trip", groupId: "g", startsAt: day(19), endsAt: day(21), excludedEventIds: [] as string[] };
  const event = (id: string, start: number, end: number | null, groupId = "g") => ({
    id,
    groupId,
    startsAt: start,
    endsAt: end,
  });

  it("期間に重なる同じグループの予定は、自動で入る", () => {
    expect(memoryOfEvent(event("e", day(19) + 3_600_000, day(19) + 7_200_000), [trip])?.id).toBe("trip");
  });

  it("別のグループと、期間の外の予定は入らない", () => {
    expect(memoryOfEvent(event("e", day(19), day(20), "other"), [trip])).toBeUndefined();
    expect(memoryOfEvent(event("e", day(22), day(23)), [trip])).toBeUndefined();
  });

  it("外した予定は入らない。重なる思い出がほかにあれば、そちらに入る", () => {
    const walk = { id: "walk", groupId: "g", startsAt: day(20), endsAt: day(21), excludedEventIds: [] };
    const e = event("e", day(20) + 3_600_000, null);
    expect(memoryOfEvent(e, [walk, trip])?.id).toBe("trip");
    expect(memoryOfEvent(e, [walk, { ...trip, excludedEventIds: ["e"] }])?.id).toBe("walk");
  });
});
