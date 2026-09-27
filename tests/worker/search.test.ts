import { resolveExtensionGroupIds } from "@server/core/extension-access";
import { searchQuery } from "@shared/schemas";
import { describe, expect, it } from "vitest";

const manifests = [
  { key: "events", alwaysOn: true },
  { key: "memories", alwaysOn: false },
  { key: "external", alwaysOn: true },
];

describe("拡張ごとに呼んでよいグループ。0046", () => {
  it("いつも有効な拡張には、渡したグループをそのまま渡す", () => {
    const byExt = resolveExtensionGroupIds(manifests, ["g1", "g2"], "g1", []);
    expect(byExt.get("events")).toEqual(["g1", "g2"]);
    expect(byExt.get("external")).toEqual(["g1", "g2"]);
  });

  it("F-24 で自分は使うと決めていても、共有グループの側で無効なら、そのグループは渡さない", () => {
    const byExt = resolveExtensionGroupIds(manifests, ["p", "g1", "g2"], "p", [
      { groupId: "p", extensionKey: "memories" }, // 自分は使うと決めている。F-24
      { groupId: "g1", extensionKey: "memories" }, // g1 では有効。g2 では有効にしていない。F-11
    ]);
    expect(byExt.get("memories")).toEqual(["p", "g1"]);
  });

  it("自分は使うと決めていなければ、共有グループの側で有効でも探さない。F-24", () => {
    const byExt = resolveExtensionGroupIds(
      manifests,
      ["p", "g1"],
      "p",
      [{ groupId: "g1", extensionKey: "memories" }], // 自分の「使う」は切ったまま
    );
    expect(byExt.get("memories")).toEqual([]);
  });

  it("入っていないグループの enabled 行があっても、渡した groupIds の外には出さない。他人のグループを混ぜない", () => {
    const byExt = resolveExtensionGroupIds(
      manifests,
      ["p", "g1"], // g9 は入っていない、あるいは絞り込みで選んでいない
      "p",
      [
        { groupId: "p", extensionKey: "memories" },
        { groupId: "g9", extensionKey: "memories" }, // 入っていないグループの行が紛れ込んでも
      ],
    );
    expect(byExt.get("memories")).toEqual(["p"]);
  });

  it("呼んでよいグループが 1 つも無ければ、その拡張は空の配列を返す", () => {
    const byExt = resolveExtensionGroupIds(manifests, [], undefined, []);
    expect(byExt.get("memories")).toEqual([]);
    expect(byExt.get("events")).toEqual([]);
  });
});

describe("GET /api/search の問い合わせ。0046", () => {
  it("前後の空白を除いて 1 文字以上を通す", () => {
    expect(searchQuery.safeParse({ q: "  歯医者  " }).success).toBe(true);
    expect(searchQuery.safeParse({ q: "  歯医者  " }).data?.q).toBe("歯医者");
  });

  it("空、あるいは空白だけは断る", () => {
    expect(searchQuery.safeParse({ q: "" }).success).toBe(false);
    expect(searchQuery.safeParse({ q: "   " }).success).toBe(false);
    expect(searchQuery.safeParse({}).success).toBe(false);
  });

  it("101 文字以上は断る", () => {
    expect(searchQuery.safeParse({ q: "あ".repeat(101) }).success).toBe(false);
  });
});
