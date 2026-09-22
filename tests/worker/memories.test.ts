import { describe, expect, it } from "vitest";
import { addDaysToKey, dayIndexOf, dayKeyIn, hourIn, memoryDays, startOfDayIn } from "../../src/extensions/memories/shared/days";
import { memoryInput, recordInput } from "../../src/extensions/memories/shared/schemas";
import { PhotoSigner, expiryFor, isJpeg, photoKey, verifyPhotoUrl } from "../../src/extensions/memories/server/photos";

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

  const memory = { startsAt: startOfDayIn("2026-09-19", "Asia/Tokyo"), endsAt: startOfDayIn("2026-09-21", "Asia/Tokyo"), timeZone: "Asia/Tokyo" };

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
  const base = { groupId: "g", title: "箱根 1 泊", firstDay: "2026-09-19", lastDay: "2026-09-20", timeZone: "Asia/Tokyo" };

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
    expect(photoKey("g", "p", "full")).toBe("m/g/p.jpg");
    expect(photoKey("g", "p", "thumb")).toBe("m/g/p_t.jpg");
    expect(isJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(isJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
  });
});
