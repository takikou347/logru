import { kakeiboCategoryLabel } from "@extensions/kakeibo/shared/categories";
import { dateKeyOfJst, isDateKey, isMonthKey, monthRange, startOfDateJst } from "@extensions/kakeibo/shared/dates";
import { formatYen } from "@extensions/kakeibo/shared/format";
import { kakeiboInput, kakeiboPatchInput } from "@extensions/kakeibo/shared/schemas";
import { sumAmount, summarizeByCategory } from "@extensions/kakeibo/shared/totals";
import { describe, expect, it } from "vitest";

describe("家計簿の日付", () => {
  it("`2026-09-22` の形だけを日付として通す。F-301", () => {
    expect(isDateKey("2026-09-22")).toBe(true);
    expect(isDateKey("2026-9-22")).toBe(false);
    expect(isDateKey("2026-13-01")).toBe(false);
    expect(isDateKey("2026-02-30")).toBe(false);
  });

  it("日本時間の 0 時を協定世界時で返す", () => {
    expect(new Date(startOfDateJst("2026-09-22")).toISOString()).toBe("2026-09-21T15:00:00.000Z");
  });

  it("協定世界時から、日本時間の日付を読む", () => {
    expect(dateKeyOfJst(Date.parse("2026-09-21T15:00:00Z"))).toBe("2026-09-22");
    expect(dateKeyOfJst(Date.parse("2026-09-21T14:59:59Z"))).toBe("2026-09-21");
  });

  it("`2026-09` の形だけを月として通す", () => {
    expect(isMonthKey("2026-09")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("2026-9")).toBe(false);
  });

  it("月の初日と、次の月の初日を返す", () => {
    expect(monthRange("2026-09")).toEqual({ from: "2026-09-01", to: "2026-10-01" });
    expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2027-01-01" });
  });
});

describe("家計簿のカテゴリ", () => {
  it("6 つの固定のカテゴリのラベルを返す。F-301", () => {
    expect(kakeiboCategoryLabel("food")).toBe("食費");
    expect(kakeiboCategoryLabel("daily_goods")).toBe("日用品");
    expect(kakeiboCategoryLabel("other")).toBe("その他");
  });

  it("知らないカテゴリは ID をそのまま返す", () => {
    expect(kakeiboCategoryLabel("unknown")).toBe("unknown");
  });
});

describe("金額の表示", () => {
  it("円の形に整える", () => {
    expect(formatYen(1200)).toBe("¥1,200");
    expect(formatYen(0)).toBe("¥0");
  });
});

describe("月の合計。F-303", () => {
  const rows = [
    { category: "food" as const, amount: 1200 },
    { category: "food" as const, amount: 300 },
    { category: "transport" as const, amount: 500 },
  ];

  it("記録の金額をすべて足す", () => {
    expect(sumAmount(rows)).toBe(2000);
    expect(sumAmount([])).toBe(0);
  });

  it("カテゴリごとに合計する。記録が無いカテゴリも 0 で 6 件すべて返す", () => {
    const byCategory = summarizeByCategory(rows);
    expect(byCategory).toHaveLength(6);
    expect(byCategory.find((c) => c.category === "food")?.total).toBe(1500);
    expect(byCategory.find((c) => c.category === "transport")?.total).toBe(500);
    expect(byCategory.find((c) => c.category === "hobby")?.total).toBe(0);
  });
});

describe("家計簿の入力。F-301", () => {
  const base = { groupId: "g", date: "2026-09-22", amount: 1200, category: "food" as const };

  it("金額、カテゴリ、日付がそろえば通す", () => {
    expect(kakeiboInput.safeParse(base).success).toBe(true);
  });

  it("0 円以下、100 万円を超える額、整数でない額は断る", () => {
    expect(kakeiboInput.safeParse({ ...base, amount: 0 }).success).toBe(false);
    expect(kakeiboInput.safeParse({ ...base, amount: -100 }).success).toBe(false);
    expect(kakeiboInput.safeParse({ ...base, amount: 1_000_001 }).success).toBe(false);
    expect(kakeiboInput.safeParse({ ...base, amount: 12.5 }).success).toBe(false);
  });

  it("知らないカテゴリと、形の違う日付は断る", () => {
    expect(kakeiboInput.safeParse({ ...base, category: "rent" }).success).toBe(false);
    expect(kakeiboInput.safeParse({ ...base, date: "2026/09/22" }).success).toBe(false);
  });

  it("グループが空なら断る", () => {
    expect(kakeiboInput.safeParse({ ...base, groupId: "" }).success).toBe(false);
  });

  it("メモは 200 字まで。省いても通る", () => {
    expect(kakeiboInput.safeParse({ ...base, memo: "コンビニ" }).success).toBe(true);
    expect(kakeiboInput.safeParse({ ...base, memo: "あ".repeat(201) }).success).toBe(false);
    expect(kakeiboInput.safeParse(base).success).toBe(true);
  });

  it("直すときは、送った項目だけを確かめる。F-307", () => {
    expect(kakeiboPatchInput.safeParse({}).success).toBe(true);
    expect(kakeiboPatchInput.safeParse({ amount: 500 }).success).toBe(true);
    expect(kakeiboPatchInput.safeParse({ amount: 0 }).success).toBe(false);
    expect(kakeiboPatchInput.safeParse({ category: "hobby" }).success).toBe(true);
  });
});
