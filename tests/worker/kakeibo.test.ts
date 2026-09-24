import { kakeiboAccountKindLabel } from "@extensions/kakeibo/shared/accounts";
import { isExpenseCategory, isIncomeCategory, kakeiboCategoryLabel } from "@extensions/kakeibo/shared/categories";
import { dateKeyOfJst, isDateKey, isMonthKey, monthRange, startOfDateJst } from "@extensions/kakeibo/shared/dates";
import { formatSignedYen, formatYen } from "@extensions/kakeibo/shared/format";
import { kakeiboAccountInput, kakeiboAccountPatchInput, kakeiboInput } from "@extensions/kakeibo/shared/schemas";
import { sumByType, summarizeExpenseByCategory } from "@extensions/kakeibo/shared/totals";
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

describe("家計簿のカテゴリ。0069", () => {
  it("支出 15、収入 4 のラベルを返す", () => {
    expect(kakeiboCategoryLabel("food")).toBe("食費");
    expect(kakeiboCategoryLabel("housing")).toBe("住まい");
    expect(kakeiboCategoryLabel("salary")).toBe("給料");
    expect(kakeiboCategoryLabel("other_income")).toBe("その他の収入");
  });

  it("知らないカテゴリは ID をそのまま返す", () => {
    expect(kakeiboCategoryLabel("unknown")).toBe("unknown");
  });

  it("支出・収入のカテゴリを見分ける", () => {
    expect(isExpenseCategory("food")).toBe(true);
    expect(isExpenseCategory("salary")).toBe(false);
    expect(isIncomeCategory("salary")).toBe(true);
    expect(isIncomeCategory("food")).toBe(false);
  });
});

describe("口座の種類。0069、F-309", () => {
  it("現金、銀行、カード、電子マネー、その他のラベルを返す", () => {
    expect(kakeiboAccountKindLabel("cash")).toBe("現金");
    expect(kakeiboAccountKindLabel("bank")).toBe("銀行");
    expect(kakeiboAccountKindLabel("card")).toBe("カード");
    expect(kakeiboAccountKindLabel("emoney")).toBe("電子マネー");
    expect(kakeiboAccountKindLabel("other")).toBe("その他");
  });
});

describe("金額の表示", () => {
  it("円の形に整える。マイナスは頭に付ける", () => {
    expect(formatYen(1200)).toBe("¥1,200");
    expect(formatYen(0)).toBe("¥0");
    expect(formatYen(-1200)).toBe("-¥1,200");
  });

  it("収入の行は符号を付ける", () => {
    expect(formatSignedYen(1200)).toBe("+¥1,200");
    expect(formatSignedYen(-1200)).toBe("-¥1,200");
  });
});

describe("種類ごとの合計と、支出のカテゴリ別の合計。F-303", () => {
  const rows = [
    { type: "expense" as const, category: "food" as const, amount: 1200 },
    { type: "expense" as const, category: "food" as const, amount: 300 },
    { type: "expense" as const, category: "transport" as const, amount: 500 },
    { type: "income" as const, category: "salary" as const, amount: 3000 },
    { type: "transfer" as const, category: "transfer" as const, amount: 1000 },
  ];

  it("種類ごとに金額を足す。振替は数えない", () => {
    expect(sumByType(rows, "expense")).toBe(2000);
    expect(sumByType(rows, "income")).toBe(3000);
    expect(sumByType([], "expense")).toBe(0);
  });

  it("記録のある支出のカテゴリだけを、多い順で返す", () => {
    const byCategory = summarizeExpenseByCategory(rows);
    expect(byCategory).toEqual([
      { category: "food", total: 1500 },
      { category: "transport", total: 500 },
    ]);
  });
});

describe("記録の入力。F-301、F-310、F-311", () => {
  const expense = {
    type: "expense" as const,
    groupId: "g",
    date: "2026-09-22",
    amount: 1200,
    category: "food" as const,
  };

  it("支出の形がそろえば通す", () => {
    expect(kakeiboInput.safeParse(expense).success).toBe(true);
  });

  it("収入と振替も通す。振替はグループを送らなくてよい", () => {
    expect(kakeiboInput.safeParse({ ...expense, type: "income", category: "salary" }).success).toBe(true);
    expect(
      kakeiboInput.safeParse({ type: "transfer", date: "2026-09-22", amount: 500, accountId: "a", toAccountId: "b" })
        .success,
    ).toBe(true);
  });

  it("0 円以下、1 億円を超える額、整数でない額は断る", () => {
    expect(kakeiboInput.safeParse({ ...expense, amount: 0 }).success).toBe(false);
    expect(kakeiboInput.safeParse({ ...expense, amount: -100 }).success).toBe(false);
    expect(kakeiboInput.safeParse({ ...expense, amount: 100_000_001 }).success).toBe(false);
    expect(kakeiboInput.safeParse({ ...expense, amount: 12.5 }).success).toBe(false);
  });

  it("知らない種類・カテゴリと、形の違う日付は断る", () => {
    expect(kakeiboInput.safeParse({ ...expense, type: "rent" }).success).toBe(false);
    expect(kakeiboInput.safeParse({ ...expense, category: "rent" }).success).toBe(false);
    expect(kakeiboInput.safeParse({ ...expense, date: "2026/09/22" }).success).toBe(false);
  });

  it("メモは 200 字まで。省いても通る", () => {
    expect(kakeiboInput.safeParse({ ...expense, memo: "コンビニ" }).success).toBe(true);
    expect(kakeiboInput.safeParse({ ...expense, memo: "あ".repeat(201) }).success).toBe(false);
    expect(kakeiboInput.safeParse(expense).success).toBe(true);
  });
});

describe("口座の入力。F-309", () => {
  const account = { groupId: "g", name: "現金", kind: "cash" as const, openingBalance: 0 };

  it("形がそろえば通す。マイナスの始まりの残高も通す", () => {
    expect(kakeiboAccountInput.safeParse(account).success).toBe(true);
    expect(kakeiboAccountInput.safeParse({ ...account, openingBalance: -50_000 }).success).toBe(true);
  });

  it("名前が空、31 字以上、種類が知らないものは断る", () => {
    expect(kakeiboAccountInput.safeParse({ ...account, name: "" }).success).toBe(false);
    expect(kakeiboAccountInput.safeParse({ ...account, name: "あ".repeat(31) }).success).toBe(false);
    expect(kakeiboAccountInput.safeParse({ ...account, kind: "wallet" }).success).toBe(false);
  });

  it("残高は -1 億から 1 億まで", () => {
    expect(kakeiboAccountInput.safeParse({ ...account, openingBalance: -100_000_001 }).success).toBe(false);
    expect(kakeiboAccountInput.safeParse({ ...account, openingBalance: 100_000_001 }).success).toBe(false);
    expect(kakeiboAccountInput.safeParse({ ...account, openingBalance: 100_000_000 }).success).toBe(true);
  });

  it("直すときは、送った項目だけを確かめる", () => {
    expect(kakeiboAccountPatchInput.safeParse({}).success).toBe(true);
    expect(kakeiboAccountPatchInput.safeParse({ archived: true }).success).toBe(true);
    expect(kakeiboAccountPatchInput.safeParse({ name: "" }).success).toBe(false);
  });
});
