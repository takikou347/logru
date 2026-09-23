import { describe, expect, it } from "vitest";
import { extensionGroups, extensionLabel } from "../../src/client/lib/extension-visuals";

describe("拡張ごとの種類の並び。0056", () => {
  it("予定の拡張を先頭にし、登録の順のまま並べる", () => {
    const groups = extensionGroups();
    expect(groups[0]!.key).toBe("events");
    expect(groups[0]!.label).toBe("予定");
    expect(groups.map((g) => g.key)).toEqual([...new Set(groups.map((g) => g.key))]);
  });

  it("拡張の名前を manifest の label から取る", () => {
    expect(extensionLabel("events")).toBe("予定");
    expect(extensionLabel("memories")).toBe("思い出");
    expect(extensionLabel("kakeibo")).toBe("家計簿");
  });

  it("登録に無い key はそのまま返す", () => {
    expect(extensionLabel("nothing-here")).toBe("nothing-here");
  });
});
