import { describe, expect, it } from "vitest";
import { byKind, type ItemKind, kindOf } from "../../src/client/modules/calendar/model";

describe("項目の種類。0056", () => {
  it("kind が無ければ予定として扱う", () => {
    expect(kindOf({})).toBe("event");
    expect(kindOf({ kind: "record" })).toBe("record");
    expect(kindOf({ kind: "expense" })).toBe("expense");
  });

  it("外した種類の項目だけを除く", () => {
    const items = [{ kind: undefined }, { kind: "record" as const }, { kind: "expense" as const }];
    expect(byKind(items, new Set<ItemKind>())).toEqual(items);
    expect(byKind(items, new Set<ItemKind>(["record"]))).toEqual([items[0], items[2]]);
    expect(byKind(items, new Set<ItemKind>(["event", "expense"]))).toEqual([items[1]]);
  });
});
