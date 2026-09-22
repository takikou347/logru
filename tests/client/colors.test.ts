import { describe, expect, it } from "vitest";
import { groupColor, memberColor } from "../../src/client/lib/colors";
import { GROUP_COLOR_KEYS, pickUnusedColor } from "@shared/colors";

describe("pickUnusedColor", () => {
  it("使われていない色のうち、並びの最初を返す", () => {
    expect(pickUnusedColor([])).toBe("wakatake");
    expect(pickUnusedColor(["wakatake", "yamabuki"])).toBe("asagi");
  });

  it("8 色すべて使われていたら、順に回す", () => {
    expect(pickUnusedColor([...GROUP_COLOR_KEYS])).toBe("wakatake");
    expect(pickUnusedColor([...GROUP_COLOR_KEYS, "wakatake"])).toBe("yamabuki");
  });
});

describe("自分の画面だけの色", () => {
  const prefs = [
    { targetType: "group" as const, targetId: "g1", color: "kaki" },
    { targetType: "user" as const, targetId: "u1", color: "fuji" },
  ];

  it("選んでいればその色、選んでいなければ元の色", () => {
    expect(groupColor({ id: "g1", color: "yamabuki" }, prefs)).toBe("kaki");
    expect(groupColor({ id: "g2", color: "yamabuki" }, prefs)).toBe("yamabuki");
    expect(memberColor("u1", "toki", prefs)).toBe("fuji");
    expect(memberColor("u2", "toki", prefs)).toBe("toki");
  });

  it("グループと人の ID が同じでも混ざらない", () => {
    expect(groupColor({ id: "u1", color: "asagi" }, prefs)).toBe("asagi");
  });
});
