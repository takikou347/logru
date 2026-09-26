import { dateKeyOfJst, isDateKey, startOfDateJst } from "@extensions/lists/shared/dates";
import { listInput, listItemInput, listItemPatchInput, listPatchInput } from "@extensions/lists/shared/schemas";
import { describe, expect, it } from "vitest";

describe("リストの日付", () => {
  it("`2026-09-22` の形だけを日付として通す。F-201", () => {
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
});

describe("リストを作る入力。F-201", () => {
  const base = { groupId: "g", title: "買い物" };

  it("グループと名前がそろえば通す。日付は省ける", () => {
    expect(listInput.safeParse(base).success).toBe(true);
    expect(listInput.safeParse({ ...base, date: "2026-09-22" }).success).toBe(true);
  });

  it("名前が空、あるいは空白だけは断る", () => {
    expect(listInput.safeParse({ ...base, title: "" }).success).toBe(false);
    expect(listInput.safeParse({ ...base, title: "   " }).success).toBe(false);
  });

  it("名前は 50 文字まで", () => {
    expect(listInput.safeParse({ ...base, title: "あ".repeat(50) }).success).toBe(true);
    expect(listInput.safeParse({ ...base, title: "あ".repeat(51) }).success).toBe(false);
  });

  it("グループが空、形の違う日付は断る", () => {
    expect(listInput.safeParse({ ...base, groupId: "" }).success).toBe(false);
    expect(listInput.safeParse({ ...base, date: "2026/09/22" }).success).toBe(false);
  });

  it("直すときは、送った項目だけを確かめる。F-206", () => {
    expect(listPatchInput.safeParse({}).success).toBe(true);
    expect(listPatchInput.safeParse({ title: "旅行" }).success).toBe(true);
    expect(listPatchInput.safeParse({ date: null }).success).toBe(true);
    expect(listPatchInput.safeParse({ title: "" }).success).toBe(false);
  });
});

describe("項目の入力。F-203、F-204", () => {
  it("空でない文字を通し、200 文字を超えると断る", () => {
    expect(listItemInput.safeParse({ text: "にんじん" }).success).toBe(true);
    expect(listItemInput.safeParse({ text: "" }).success).toBe(false);
    expect(listItemInput.safeParse({ text: "  " }).success).toBe(false);
    expect(listItemInput.safeParse({ text: "あ".repeat(201) }).success).toBe(false);
  });

  it("チェックの有無は真偽値だけを通す。文字だけを送っても直せる。両方省くのは断る", () => {
    expect(listItemPatchInput.safeParse({ checked: true }).success).toBe(true);
    expect(listItemPatchInput.safeParse({ checked: false }).success).toBe(true);
    expect(listItemPatchInput.safeParse({}).success).toBe(false);
    expect(listItemPatchInput.safeParse({ checked: "true" }).success).toBe(false);
  });

  it("項目の文字を直す入力は、足すときと同じ形で確かめる。F-203", () => {
    expect(listItemPatchInput.safeParse({ text: "大根" }).success).toBe(true);
    expect(listItemPatchInput.safeParse({ text: "" }).success).toBe(false);
    expect(listItemPatchInput.safeParse({ text: "  " }).success).toBe(false);
    expect(listItemPatchInput.safeParse({ text: "あ".repeat(201) }).success).toBe(false);
    expect(listItemPatchInput.safeParse({ checked: true, text: "大根" }).success).toBe(true);
  });
});
