import { describe, expect, it } from "vitest";
import { byKind, kindOf } from "../../src/client/modules/calendar/model";

describe("項目の札の形。0056", () => {
  it("kind が無ければ予定として扱う", () => {
    expect(kindOf({})).toBe("event");
    expect(kindOf({ kind: "record" })).toBe("record");
    expect(kindOf({ kind: "expense" })).toBe("expense");
  });
});

describe("絞り込みで外した拡張の項目を除く。0056", () => {
  it("項目を出した拡張の key で見分ける。形(kind)ではなく extension を見る", () => {
    const items = [{ extension: "events" }, { extension: "memories" }, { extension: "kakeibo" }];
    expect(byKind(items, new Set<string>())).toEqual(items);
    expect(byKind(items, new Set<string>(["memories"]))).toEqual([items[0], items[2]]);
    expect(byKind(items, new Set<string>(["events", "kakeibo"]))).toEqual([items[1]]);
  });
});
