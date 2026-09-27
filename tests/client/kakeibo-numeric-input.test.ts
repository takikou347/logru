import { describe, expect, it } from "vitest";
import { sanitizeAmountInput } from "../../src/extensions/kakeibo/client/numeric-input";

describe("家計簿の金額の欄に入る字", () => {
  it("数字だけを残す", () => {
    expect(sanitizeAmountInput("1,200円")).toBe("1200");
    expect(sanitizeAmountInput("abc")).toBe("");
  });

  it("日本語の入力の全角の数字も半角にして残す", () => {
    expect(sanitizeAmountInput("１２００")).toBe("1200");
  });

  it("マイナスは、許したときだけ先頭に 1 つ残す", () => {
    expect(sanitizeAmountInput("-3000")).toBe("3000");
    expect(sanitizeAmountInput("-3000", true)).toBe("-3000");
    expect(sanitizeAmountInput("－３０００", true)).toBe("-3000");
    expect(sanitizeAmountInput("30-00", true)).toBe("3000");
  });
});
