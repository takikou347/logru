import { describe, expect, it } from "vitest";
import { enabledKeys } from "../../src/client/lib/extensions";

const x = (key: string, alwaysOn = false) => ({ manifest: { key, label: key, description: "", alwaysOn } });

describe("enabledKeys", () => {
  it("いつも有効な拡張は、グループに関係なく使える", () => {
    expect([...enabledKeys([x("events", true)], [])]).toEqual(["events"]);
  });

  it("切り替えられる拡張は、どれかのグループで有効なら使える。0019", () => {
    const groups = [{ extensions: [] }, { extensions: ["memories"] }];
    expect(enabledKeys([x("events", true), x("memories"), x("money")], groups)).toEqual(new Set(["events", "memories"]));
  });

  it("どのグループでも無効なら使えない", () => {
    expect(enabledKeys([x("memories")], [{ extensions: [] }]).has("memories")).toBe(false);
  });
});
