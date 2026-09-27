import { describe, expect, it } from "vitest";
import { angleOf, favoritesOffset, RADIAL_ITEM_SIZE, radialOffset, radialTiers } from "@/lib/radial-layout";

describe("radialTiers", () => {
  it("5 個までは半径 128px の弧 1 本にする", () => {
    const items = ["a", "b", "c", "d", "e"];
    expect(radialTiers(items)).toEqual([{ items, radius: 128, from: 150, to: 30 }]);
  });

  it("1 個でも弧 1 本のまま(呼び出し側が直接開くかを別に決める)", () => {
    expect(radialTiers(["a"])).toHaveLength(1);
  });

  it("6 個以上は内側 4 つ・外側に残りの 2 重の弧にする", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g"];
    expect(radialTiers(items)).toEqual([
      { items: ["a", "b", "c", "d"], radius: 104, from: 140, to: 40 },
      { items: ["e", "f", "g"], radius: 176, from: 145, to: 35 },
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

  it("両端が弧の from と to になる", () => {
    expect(angleOf(0, 5, 150, 30)).toBe(150);
    expect(angleOf(4, 5, 150, 30)).toBe(30);
  });

  it("等間隔に並ぶ", () => {
    const total = 5;
    const angles = Array.from({ length: total }, (_, i) => angleOf(i, total, 150, 30));
    for (let i = 1; i < angles.length; i++) {
      expect(angles[i - 1]! - angles[i]!).toBeCloseTo(120 / (total - 1));
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

/** 種類の数ごとに、弧に並ぶ丸の中心(「+」の中心から)を全部返す */
function centers(count: number) {
  const items = Array.from({ length: count }, (_, i) => i);
  return radialTiers(items).flatMap((t) =>
    t.items.map((_, i) => radialOffset(angleOf(i, t.items.length, t.from, t.to), t.radius)),
  );
}

describe("弧の丸の置き場所", () => {
  const half = RADIAL_ITEM_SIZE / 2;
  // 下のタブの帯の高さ 64px の半分 + 丸の半径 + すき間 8px
  const clearBar = 32 + half + 8;

  for (let count = 2; count <= 9; count++) {
    it(`${count} 種類: どの丸も下のタブの帯に重ならない`, () => {
      for (const c of centers(count)) expect(-c.y).toBeGreaterThanOrEqual(clearBar - 0.01);
    });

    it(`${count} 種類: 幅 360px の画面の端からはみ出さない`, () => {
      for (const c of centers(count)) expect(Math.abs(c.x) + half).toBeLessThanOrEqual(180 - 4);
    });

    it(`${count} 種類: 丸どうしが重ならない`, () => {
      const cs = centers(count);
      for (let i = 0; i < cs.length; i++)
        for (let j = i + 1; j < cs.length; j++) {
          const d = Math.hypot(cs[i]!.x - cs[j]!.x, cs[i]!.y - cs[j]!.y);
          expect(d).toBeGreaterThanOrEqual(RADIAL_ITEM_SIZE + 4);
        }
    });
  }

  it("よく使う記録のカードは、いちばん上の丸より上に置く", () => {
    for (let count = 2; count <= 9; count++) {
      const items = Array.from({ length: count }, (_, i) => i);
      const top = Math.max(...centers(count).map((c) => -c.y)) + half;
      expect(favoritesOffset(radialTiers(items))).toBeGreaterThan(top);
    }
  });
});
