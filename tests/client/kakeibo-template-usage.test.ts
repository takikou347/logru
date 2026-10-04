import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { countTemplateUse, loadTemplateUsage, sortByUsage } from "../../src/extensions/kakeibo/client/template-usage";

function stubStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
  return store;
}

describe("よく使う記録の並び。issue #280", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

  afterEach(() => vi.unstubAllGlobals());

  it("回数の多い順、同じ回数なら元の並び", () => {
    expect(sortByUsage(items, { c: 3, b: 1 }).map((x) => x.id)).toEqual(["c", "b", "a"]);
    expect(sortByUsage(items, { b: 2, c: 2 }).map((x) => x.id)).toEqual(["b", "c", "a"]);
    expect(sortByUsage(items, {}).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("元の配列を変えない", () => {
    sortByUsage(items, { c: 5 });
    expect(items.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  describe("localStorage", () => {
    beforeEach(() => stubStorage());

    it("数えて読める", () => {
      countTemplateUse("a");
      countTemplateUse("a");
      countTemplateUse("b");
      expect(loadTemplateUsage()).toEqual({ a: 2, b: 1 });
    });

    it("壊れた値は空として扱い、数え直せる", () => {
      for (const bad of ["{oops", "null", "[1,2]", '"x"', '{"a":-1,"b":"3","c":1.5,"d":2}']) {
        stubStorage({ "logru-kakeibo-template-usage": bad });
        const u = loadTemplateUsage();
        expect(u).toEqual(bad.includes('"d"') ? { d: 2 } : {});
      }
      stubStorage({ "logru-kakeibo-template-usage": "{oops" });
      countTemplateUse("a");
      expect(loadTemplateUsage()).toEqual({ a: 1 });
    });

    it("読めない・書けないときも落ちない", () => {
      vi.stubGlobal("localStorage", {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("denied");
        },
      });
      expect(loadTemplateUsage()).toEqual({});
      expect(() => countTemplateUse("a")).not.toThrow();
    });

    it("localStorage 自体が無くても落ちない", () => {
      vi.unstubAllGlobals();
      expect(loadTemplateUsage()).toEqual({});
      expect(() => countTemplateUse("a")).not.toThrow();
    });
  });
});
