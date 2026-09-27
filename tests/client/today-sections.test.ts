import { describe, expect, it } from "vitest";
import {
  clampSummary,
  computeOpenSectionKeys,
  defaultTodaySummary,
  orderTodaySectionKeys,
} from "../../src/client/lib/today-sections";

describe("orderTodaySectionKeys。0092、issue #240", () => {
  it("favorite・added は、いまは同じ並び(渡された並びのまま)を返す", () => {
    const keys = ["kakeibo", "lists", "memories"];
    expect(orderTodaySectionKeys(keys, "favorite", [])).toEqual(keys);
    expect(orderTodaySectionKeys(keys, "added", ["memories", "kakeibo"])).toEqual(keys);
  });

  it("manual は、保存した並びを先に敷く", () => {
    const keys = ["kakeibo", "lists", "memories"];
    expect(orderTodaySectionKeys(keys, "manual", ["memories", "kakeibo"])).toEqual(["memories", "kakeibo", "lists"]);
  });

  it("manual で、まだ並びに無い(新しく足した)key は、渡された並びの順で末尾に足す", () => {
    expect(orderTodaySectionKeys(["kakeibo", "lists"], "manual", ["lists"])).toEqual(["lists", "kakeibo"]);
  });

  it("manual で、いま使える key に無い(外した)key は、保存した並びに残っていても落とす", () => {
    expect(orderTodaySectionKeys(["kakeibo"], "manual", ["memories", "kakeibo"])).toEqual(["kakeibo"]);
  });
});

describe("computeOpenSectionKeys。7 個以上で畳む(issue #240 の受け入れ条件)", () => {
  it("6 個までは、並べ替えた順のまま全部開く", () => {
    const keys = ["a", "b", "c", "d", "e", "f"];
    const open = computeOpenSectionKeys(keys, {});
    expect([...open]).toEqual(keys);
  });

  it("7 個以上は、先頭から 3 個だけ開き、残りは畳む", () => {
    const keys = ["a", "b", "c", "d", "e", "f", "g"];
    const open = computeOpenSectionKeys(keys, {});
    expect([...open]).toEqual(["a", "b", "c"]);
    expect(open.has("d")).toBe(false);
    expect(open.has("g")).toBe(false);
  });

  it("10 個でも、開くのは先頭の 3 個だけ", () => {
    const keys = Array.from({ length: 10 }, (_, i) => `s${i}`);
    const open = computeOpenSectionKeys(keys, {});
    expect(open.size).toBe(3);
  });

  it("openOverrides で畳んだ既定を、開くに上書きできる", () => {
    const keys = ["a", "b", "c", "d", "e", "f", "g"];
    const open = computeOpenSectionKeys(keys, { g: true });
    expect(open.has("g")).toBe(true);
    expect(open.has("a")).toBe(true);
  });

  it("openOverrides で、6 個以下でも開いている既定を、畳むに上書きできる", () => {
    const keys = ["a", "b", "c"];
    const open = computeOpenSectionKeys(keys, { b: false });
    expect(open.has("b")).toBe(false);
    expect(open.has("a")).toBe(true);
    expect(open.has("c")).toBe(true);
  });
});

describe("defaultTodaySummary・clampSummary", () => {
  it("項目が無ければ「まだ」、あれば件数", () => {
    expect(defaultTodaySummary(0)).toBe("まだ");
    expect(defaultTodaySummary(2)).toBe("2件");
  });

  it("7 文字より長ければ切る", () => {
    expect(clampSummary("123456789")).toBe("1234567");
    expect(clampSummary("まだ")).toBe("まだ");
  });
});
