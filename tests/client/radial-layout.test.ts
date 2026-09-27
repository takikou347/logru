import { describe, expect, it } from "vitest";
import { angleOf, radialOffset, radialTiers } from "@/lib/radial-layout";

describe("radialTiers", () => {
  it("5 個までは半径 128px の弧 1 本にする", () => {
    const items = ["a", "b", "c", "d", "e"];
    expect(radialTiers(items)).toEqual([{ items, radius: 128 }]);
  });

  it("1 個でも弧 1 本のまま(呼び出し側が直接開くかを別に決める)", () => {
    expect(radialTiers(["a"])).toEqual([{ items: ["a"], radius: 128 }]);
  });

  it("6 個以上は内側 4 つ・外側に残りの 2 重の弧にする", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g"];
    expect(radialTiers(items)).toEqual([
      { items: ["a", "b", "c", "d"], radius: 100 },
      { items: ["e", "f", "g"], radius: 176 },
    ]);
  });

  it("ちょうど 6 個でも 2 重にする", () => {
    const items = [1, 2, 3, 4, 5, 6];
    const tiers = radialTiers(items);
    expect(tiers).toHaveLength(2);
    expect(tiers[0]?.items).toHaveLength(4);
    expect(tiers[1]?.items).toHaveLength(2);
  });
});

describe("angleOf", () => {
  it("1 個だけの弧は真上(90°)に置く", () => {
    expect(angleOf(0, 1)).toBe(90);
  });

  it("両端が親指に近い右寄り(165°)から左寄り(15°)になる", () => {
    expect(angleOf(0, 5)).toBe(165);
    expect(angleOf(4, 5)).toBe(15);
  });

  it("等間隔に並ぶ", () => {
    const total = 5;
    const angles = Array.from({ length: total }, (_, i) => angleOf(i, total));
    for (let i = 1; i < angles.length; i++) {
      expect(angles[i - 1]! - angles[i]!).toBeCloseTo(150 / (total - 1));
    }
  });
});

describe("radialOffset", () => {
  it("真上(90°)は x が 0、y が半径だけ上(マイナス)になる", () => {
    const { x, y } = radialOffset(90, 128);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(-128);
  });

  it("右(0°)は x が半径ぶん、y は 0", () => {
    const { x, y } = radialOffset(0, 100);
    expect(x).toBeCloseTo(100);
    expect(y).toBeCloseTo(0);
  });
});
