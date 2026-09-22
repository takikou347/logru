import { describe, expect, it } from "vitest";
import { enabledKeys } from "../../src/client/lib/extensions";

const x = (key: string, alwaysOn = false) => ({ manifest: { key, label: key, description: "", alwaysOn } });

describe("enabledKeys", () => {
  it("いつも有効な拡張は、グループに関係なく使える", () => {
    expect([...enabledKeys([x("events", true)], [])]).toEqual(["events"]);
  });

  it("切り替えられる拡張は、本人が使うと決めたときだけ使える。0019", () => {
    const groups = [
      { isPersonal: true, extensions: ["memories"] },
      { isPersonal: false, extensions: [] },
    ];
    expect(enabledKeys([x("events", true), x("memories"), x("money")], groups)).toEqual(
      new Set(["events", "memories"]),
    );
  });

  it("共有のグループで有効でも、本人が使わないなら使えない", () => {
    const groups = [
      { isPersonal: true, extensions: [] },
      { isPersonal: false, extensions: ["memories"] },
    ];
    expect(enabledKeys([x("memories")], groups).has("memories")).toBe(false);
  });
});
