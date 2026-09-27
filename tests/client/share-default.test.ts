import { describe, expect, it } from "vitest";
import { defaultShareGroupId } from "../../src/client/lib/share-default";

const personal = { id: "me", isPersonal: true, extensions: [] as string[] };
const withMemories = { id: "g1", isPersonal: false, extensions: ["memories"] };
const withoutMemories = { id: "g2", isPersonal: false, extensions: [] as string[] };
const groups = [personal, withMemories, withoutMemories];

describe("defaultShareGroupId。0063、F-40", () => {
  it("画面で絞っているグループがあれば、それを使う", () => {
    expect(defaultShareGroupId(groups, "g2", { groupId: "g1", extensionKey: "memories", alwaysOn: false })).toBe("g2");
  });

  it("いつもの共有先があり、その拡張を足していれば、それを使う", () => {
    expect(defaultShareGroupId(groups, null, { groupId: "g1", extensionKey: "memories", alwaysOn: false })).toBe("g1");
  });

  it("いつもの共有先が、その拡張を足していないグループなら、共有しないに落ちる", () => {
    expect(defaultShareGroupId(groups, null, { groupId: "g2", extensionKey: "memories", alwaysOn: false })).toBe("me");
  });

  it("いつも有効な拡張(alwaysOn)なら、足しているかを見ずにいつもの共有先を使う", () => {
    expect(defaultShareGroupId(groups, null, { groupId: "g2", extensionKey: "events", alwaysOn: true })).toBe("g2");
  });

  it("いつもの共有先を決めていなければ、共有しないに落ちる", () => {
    expect(defaultShareGroupId(groups, null, { groupId: null, extensionKey: "memories", alwaysOn: false })).toBe("me");
  });

  it("いつもの共有先がもう入っていないグループを指していたら、共有しないに落ちる", () => {
    expect(defaultShareGroupId(groups, null, { groupId: "gone", extensionKey: "memories", alwaysOn: false })).toBe(
      "me",
    );
  });
});
