import { kakeiboAccountKindLabel } from "@extensions/kakeibo/shared/accounts";
import { isExpenseCategory, isIncomeCategory, kakeiboCategoryLabel } from "@extensions/kakeibo/shared/categories";
import { dateKeyOfJst, isDateKey, isMonthKey, monthRange, startOfDateJst } from "@extensions/kakeibo/shared/dates";
import { formatSignedYen, formatYen } from "@extensions/kakeibo/shared/format";
import {
  daysInMonth,
  dueDayOfMonth,
  isRecurringActiveInMonth,
  monthKeyOfDate,
} from "@extensions/kakeibo/shared/recurring";
import {
  kakeiboAccountInput,
  kakeiboAccountPatchInput,
  kakeiboInput,
  kakeiboRecurringInput,
  kakeiboSettlementInput,
  kakeiboTemplateInput,
} from "@extensions/kakeibo/shared/schemas";
import { minimalTransfers, netBalances } from "@extensions/kakeibo/shared/settlement";
import { splitEqually, splitNone, sumSplitShares } from "@extensions/kakeibo/shared/splits";
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

describe("割り勘。0072、F-318", () => {
  it("全員で同じ額に割る。割り切れる", () => {
    const shares = splitEqually(3000, ["a", "b", "c"], "a");
    expect(shares).toEqual([
      { userId: "a", amount: 1000 },
      { userId: "b", amount: 1000 },
      { userId: "c", amount: 1000 },
    ]);
    expect(sumSplitShares(shares)).toBe(3000);
  });

  it("割り切れない 1 円は、払った人から順に足す", () => {
    const shares = splitEqually(1000, ["a", "b", "c"], "b");
    // 1000 / 3 = 333 あまり 1。払った b が先頭、次に a、c の順で 1 円を足す
    expect(shares.find((s) => s.userId === "b")!.amount).toBe(334);
    expect(shares.find((s) => s.userId === "a")!.amount).toBe(333);
    expect(shares.find((s) => s.userId === "c")!.amount).toBe(333);
    expect(sumSplitShares(shares)).toBe(1000);
  });

  it("端数が 2 人分でも、払った人から順に足して合計が合う", () => {
    const shares = splitEqually(100, ["a", "b", "c", "d"], "c");
    // 100 / 4 = 25 ちょうど、あまり無し
    expect(sumSplitShares(shares)).toBe(100);
    const shares2 = splitEqually(101, ["a", "b", "c", "d"], "c");
    expect(shares2.find((s) => s.userId === "c")!.amount).toBe(26);
    expect(sumSplitShares(shares2)).toBe(101);
  });

  it("1 人だけのグループでも、その人の全額になる", () => {
    const shares = splitEqually(500, ["a"], "a");
    expect(shares).toEqual([{ userId: "a", amount: 500 }]);
  });

  it("割らないときは、払った人の全額になる", () => {
    expect(splitNone(2000, "a")).toEqual([{ userId: "a", amount: 2000 }]);
  });

  it("どの金額・人数の組み合わせでも、負担額の合計は必ず金額と同じ", () => {
    for (const amount of [1, 2, 3, 10, 999, 12345, 100_000_000]) {
      for (const n of [1, 2, 3, 5, 7]) {
        const members = Array.from({ length: n }, (_, i) => `u${i}`);
        for (const payer of members) {
          expect(sumSplitShares(splitEqually(amount, members, payer))).toBe(amount);
        }
      }
    }
  });
});

describe("精算の計算。0072、F-320", () => {
  it("払った額と負担額の差し引きを出す", () => {
    const net = netBalances(
      [{ userId: "a", amount: 3000 }],
      [
        { userId: "a", amount: 1000 },
        { userId: "b", amount: 1000 },
        { userId: "c", amount: 1000 },
      ],
    );
    expect(net.get("a")).toBe(2000);
    expect(net.get("b")).toBe(-1000);
    expect(net.get("c")).toBe(-1000);
  });

  it("精算した記録の分だけ、差し引きを 0 に近づける", () => {
    const net = netBalances(
      [{ userId: "a", amount: 3000 }],
      [{ userId: "a", amount: 1000 }],
      [{ from: "b", to: "a", amount: 1000 }],
    );
    expect(net.get("a")).toBe(2000 - 1000);
    expect(net.get("b")).toBe(1000);
  });

  it("送る回数がいちばん少ない組み合わせを、貸しの多い人と借りの多い人から順に当てて作る", () => {
    const net = new Map([
      ["a", 2000],
      ["b", -1000],
      ["c", -1000],
    ]);
    const transfers = minimalTransfers(net);
    expect(transfers).toEqual(
      expect.arrayContaining([
        { from: "b", to: "a", amount: 1000 },
        { from: "c", to: "a", amount: 1000 },
      ]),
    );
    expect(transfers).toHaveLength(2);
  });

  it("3 人で 1 人が立て替えたときは、残りの 2 人がそれぞれ払うだけで済む", () => {
    // 3 万円を a が立て替え、3 人で均等割り
    const shares = splitEqually(30_000, ["a", "b", "c"], "a");
    const net = netBalances([{ userId: "a", amount: 30_000 }], shares);
    const transfers = minimalTransfers(net);
    expect(transfers.sort((x, y) => x.from.localeCompare(y.from))).toEqual([
      { from: "b", to: "a", amount: 10_000 },
      { from: "c", to: "a", amount: 10_000 },
    ]);
  });

  it("貸し借りが無ければ、送る組み合わせは無い", () => {
    expect(minimalTransfers(netBalances([{ userId: "a", amount: 1000 }], [{ userId: "a", amount: 1000 }]))).toEqual([]);
  });

  it("複雑な組み合わせでも、必ず全員の差し引きが 0 になるまで割り当てる", () => {
    const net = new Map([
      ["a", 500],
      ["b", 300],
      ["c", -200],
      ["d", -600],
    ]);
    const transfers = minimalTransfers(new Map(net));
    const settled = new Map(net);
    for (const t of transfers) {
      settled.set(t.from, (settled.get(t.from) ?? 0) + t.amount);
      settled.set(t.to, (settled.get(t.to) ?? 0) - t.amount);
    }
    for (const v of settled.values()) expect(v).toBe(0);
    // 4 人の貸し借りは、多くて 3 回で済む
    expect(transfers.length).toBeLessThanOrEqual(3);
  });
});

describe("定期の記録の日付。0072、F-325", () => {
  it("月の日数を返す", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 9)).toBe(30);
    expect(daysInMonth(2026, 1)).toBe(31);
  });

  it("31 日を指定した月は、その月の月末になる", () => {
    expect(dueDayOfMonth(31, 2026, 9)).toBe(30);
    expect(dueDayOfMonth(31, 2026, 1)).toBe(31);
    expect(dueDayOfMonth(15, 2026, 9)).toBe(15);
  });

  it("始まりの月より前、終わりの月より後、止めた記録は動かない", () => {
    const base = {
      dayOfMonth: 27,
      startMonth: "2026-06",
      endMonth: null as string | null,
      lastMonth: null as string | null,
      pausedAt: null as number | null,
    };
    expect(isRecurringActiveInMonth(base, "2026-05")).toBe(false);
    expect(isRecurringActiveInMonth(base, "2026-06")).toBe(true);
    expect(isRecurringActiveInMonth({ ...base, endMonth: "2026-08" }, "2026-09")).toBe(false);
    expect(isRecurringActiveInMonth({ ...base, pausedAt: Date.now() }, "2026-09")).toBe(false);
  });

  it("同じ月にすでに入れていれば動かない", () => {
    const base = {
      dayOfMonth: 27,
      startMonth: "2026-06",
      endMonth: null as string | null,
      lastMonth: "2026-09",
      pausedAt: null as number | null,
    };
    expect(isRecurringActiveInMonth(base, "2026-09")).toBe(false);
    expect(isRecurringActiveInMonth(base, "2026-10")).toBe(true);
  });

  it("`2026-09-24` から `2026-09` を作る", () => {
    expect(monthKeyOfDate("2026-09-24")).toBe("2026-09");
  });
});

describe("精算の入力。0072、F-321", () => {
  const settlement = { groupId: "g", fromUser: "a", toUser: "b", amount: 1000, date: "2026-09-24" };

  it("形がそろえば通す", () => {
    expect(kakeiboSettlementInput.safeParse(settlement).success).toBe(true);
  });

  it("送った人と受け取った人が同じなら断る", () => {
    expect(kakeiboSettlementInput.safeParse({ ...settlement, toUser: "a" }).success).toBe(false);
  });

  it("0 円以下は断る", () => {
    expect(kakeiboSettlementInput.safeParse({ ...settlement, amount: 0 }).success).toBe(false);
  });
});

describe("定期の記録の入力。0072、F-325", () => {
  const recurring = {
    groupId: "g",
    type: "expense" as const,
    amount: 80_000,
    category: "housing" as const,
    dayOfMonth: 27,
    startMonth: "2026-09",
  };

  it("形がそろえば通す", () => {
    expect(kakeiboRecurringInput.safeParse(recurring).success).toBe(true);
  });

  it("毎月の日は 1 から 31 まで", () => {
    expect(kakeiboRecurringInput.safeParse({ ...recurring, dayOfMonth: 0 }).success).toBe(false);
    expect(kakeiboRecurringInput.safeParse({ ...recurring, dayOfMonth: 32 }).success).toBe(false);
    expect(kakeiboRecurringInput.safeParse({ ...recurring, dayOfMonth: 31 }).success).toBe(true);
  });

  it("始まりの月・終わりの月は `2026-09` の形", () => {
    expect(kakeiboRecurringInput.safeParse({ ...recurring, startMonth: "2026/09" }).success).toBe(false);
    expect(kakeiboRecurringInput.safeParse({ ...recurring, endMonth: "2026-12" }).success).toBe(true);
  });
});

describe("よく使う記録の入力。0072、F-326", () => {
  const template = { name: "スーパー", type: "expense" as const, category: "food" as const };

  it("形がそろえば通す。金額は省ける", () => {
    expect(kakeiboTemplateInput.safeParse(template).success).toBe(true);
    expect(kakeiboTemplateInput.safeParse({ ...template, amount: 1000 }).success).toBe(true);
  });

  it("名前は 1 から 30 字", () => {
    expect(kakeiboTemplateInput.safeParse({ ...template, name: "" }).success).toBe(false);
    expect(kakeiboTemplateInput.safeParse({ ...template, name: "あ".repeat(31) }).success).toBe(false);
  });
});
