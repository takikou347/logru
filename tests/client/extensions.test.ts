import { describe, expect, it } from "vitest";
import { enabledKeys, orderedExtensionKeys } from "../../src/client/lib/extensions";

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

describe("orderedExtensionKeys。0058", () => {
  it("保存した並びの順を守る", () => {
    expect(orderedExtensionKeys(["b", "a"], ["a", "b"])).toEqual(["b", "a"]);
  });

  it("まだ並びに無い(新しく足した)key は、拡張の一覧の順で末尾に足す", () => {
    expect(orderedExtensionKeys(["b"], ["a", "b", "c"])).toEqual(["b", "a", "c"]);
  });

  it("外した key は、保存した並びに残っていても消える", () => {
    expect(orderedExtensionKeys(["a", "b"], ["a"])).toEqual(["a"]);
  });

  it("保存した並びが空でも、拡張の一覧の順で返す", () => {
    expect(orderedExtensionKeys([], ["a", "b"])).toEqual(["a", "b"]);
  });
});
