import { describe, expect, it } from "vitest";
import type { KakeiboTemplate } from "../../src/extensions/kakeibo/client/api";
import { quickSaveInput } from "../../src/extensions/kakeibo/client/quick-adds";

const groups = [
  { id: "me", isPersonal: true },
  { id: "family", isPersonal: false },
];
const base: KakeiboTemplate = {
  id: "t1",
  name: "コーヒー",
  type: "expense",
  groupId: null,
  category: "food",
  accountId: null,
  toAccountId: null,
  memo: null,
  amount: 450,
};

describe("quickSaveInput(長押しの一発保存)", () => {
  it("グループが空なら自分だけに、今日の日付で保存する入力を作る", () => {
    expect(quickSaveInput(base, groups, "u1", "2026-10-25")).toEqual({
      type: "expense",
      groupId: "me",
      date: "2026-10-25",
      amount: 450,
      category: "food",
      accountId: null,
      memo: null,
    });
  });

  it("金額が無い・カテゴリが無い・振替は作らない(シートを開く)", () => {
    expect(quickSaveInput({ ...base, amount: null }, groups, "u1", "2026-10-25")).toBeNull();
    expect(quickSaveInput({ ...base, category: null }, groups, "u1", "2026-10-25")).toBeNull();
    expect(quickSaveInput({ ...base, type: "transfer" }, groups, "u1", "2026-10-25")).toBeNull();
  });

  it("共有のグループの支出は、口座が無ければ自分が払って均等に割る", () => {
    const got = quickSaveInput({ ...base, groupId: "family" }, groups, "u1", "2026-10-25");
    expect(got).toMatchObject({ groupId: "family", paidBy: "u1", splitMode: "equal" });
  });

  it("共有のグループで口座が決まっているものは、シートへ回す", () => {
    expect(quickSaveInput({ ...base, groupId: "family", accountId: "a1" }, groups, "u1", "2026-10-25")).toBeNull();
  });

  it("使えなくなったグループは自分だけに戻す", () => {
    expect(quickSaveInput({ ...base, groupId: "gone" }, groups, "u1", "2026-10-25")?.groupId).toBe("me");
  });
});
