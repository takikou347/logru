import { describe, expect, it } from "vitest";
import { contrastRatio } from "../../src/client/lib/contrast";

/**
 * 見た目の土台ごとのトークンの、文字と地の比。0090、0095、F-43
 *
 * 値は src/client/styles/tokens.css の各 `[data-look="..."]` の節と合わせる。地の色が
 * グラデーションの節(水・夜空・季節)は、グラデーションの中でいちばん薄い色(白を重ねる側)で
 * 確かめる。白を重ねるほど、暗い ink との比は上がる一方なので、いちばん薄い色が最も厳しい側になる
 * (夜空のダークだけ逆に、星の粒がわずかに明るくする側なので、地そのものの色で確かめれば足りる)。
 * tokens.css の値を変えたら、ここも合わせて直す。
 */
const PAPER_LIGHT = { ground: "#f2e9d6", panel: "#f6eeda", ink: "#241b12", ink2: "#6e5c42", ink3: "#7c6c52" };
const PAPER_DARK = { ground: "#1c1712", panel: "#201a14", ink: "#ece4d3", ink2: "#b8a98e", ink3: "#8f8268" };
/* 水。地は radial-gradient の白を最大 22%(ダークは 14%)重ねた側で確かめる */
const WATER_LIGHT = { ground: "#dcecee", panel: "#eaf6f7", ink: "#0f2c33", ink2: "#365a61", ink3: "#4c6e74" };
const WATER_DARK = { ground: "#081a20", panel: "#0e242b", ink: "#e2f2f4", ink2: "#a9c9cd", ink3: "#8fb3b8" };
/* 夜空。ライトは薄明の空、ダークは深い藍の空(星の粒は数 px の点なので地の色で足りる) */
const NIGHT_LIGHT = { ground: "#eef0f7", panel: "#f6f4fb", ink: "#221f38", ink2: "#544f77", ink3: "#6b6690" };
const NIGHT_DARK = { ground: "#080a14", panel: "#0f1424", ink: "#eef1fb", ink2: "#aab0cc", ink3: "#8890b0" };
/* 木 */
const WOOD_LIGHT = { ground: "#e6d1a8", panel: "#f1e2bd", ink: "#2b1a0c", ink2: "#5c4322", ink3: "#6f532c" };
const WOOD_DARK = { ground: "#1c1006", panel: "#24160a", ink: "#ecdcc0", ink2: "#c3a578", ink3: "#a98d63" };
/* 季節。4 つの季節とも ink・地の基調は同じで、季節の色はごく薄い上乗せなので基調の色で確かめる */
const SEASON_LIGHT = { ground: "#f3ece1", panel: "#faf5ec", ink: "#241f1a", ink2: "#5c5044", ink3: "#6e6153" };
const SEASON_DARK = { ground: "#191510", panel: "#211c15", ink: "#f0e8db", ink2: "#c2b6a0", ink3: "#a89b85" };

describe("紙の面。本文の文字(--ink)と、押せる行の説明(--ink-2)は 4.5:1 以上を保つ", () => {
  it("ライトは地の上でも面の上でも 4.5:1 以上", () => {
    expect(contrastRatio(PAPER_LIGHT.ink, PAPER_LIGHT.ground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(PAPER_LIGHT.ink, PAPER_LIGHT.panel)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(PAPER_LIGHT.ink2, PAPER_LIGHT.ground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(PAPER_LIGHT.ink2, PAPER_LIGHT.panel)).toBeGreaterThanOrEqual(4.5);
  });

  it("ダークは地の上でも面の上でも 4.5:1 以上", () => {
    expect(contrastRatio(PAPER_DARK.ink, PAPER_DARK.ground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(PAPER_DARK.ink, PAPER_DARK.panel)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(PAPER_DARK.ink2, PAPER_DARK.ground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(PAPER_DARK.ink2, PAPER_DARK.panel)).toBeGreaterThanOrEqual(4.5);
  });

  it("いちばん薄い補足の文字(--ink-3)も、地の上で今のリキッドガラスの比(4.18)を下回らない", () => {
    expect(contrastRatio(PAPER_LIGHT.ink3, PAPER_LIGHT.ground)).toBeGreaterThanOrEqual(4.18);
    expect(contrastRatio(PAPER_DARK.ink3, PAPER_DARK.ground)).toBeGreaterThanOrEqual(4.18);
  });
});

/** 0095 で足した水・夜空・木・季節。本文(--ink)・補足(--ink-2)は 4.5:1 以上を確かめる */
describe.each([
  ["水・ライト", WATER_LIGHT],
  ["水・ダーク", WATER_DARK],
  ["夜空・ライト", NIGHT_LIGHT],
  ["夜空・ダーク", NIGHT_DARK],
  ["木・ライト", WOOD_LIGHT],
  ["木・ダーク", WOOD_DARK],
  ["季節・ライト", SEASON_LIGHT],
  ["季節・ダーク", SEASON_DARK],
] as const)("%s。本文の文字と、押せる行の説明は 4.5:1 以上を保つ", (_name, c) => {
  it("地の上でも面の上でも 4.5:1 以上", () => {
    expect(contrastRatio(c.ink, c.ground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(c.ink, c.panel)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(c.ink2, c.ground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(c.ink2, c.panel)).toBeGreaterThanOrEqual(4.5);
  });

  it("いちばん薄い補足の文字(--ink-3)も、地の上で 4.18 を下回らない", () => {
    expect(contrastRatio(c.ink3, c.ground)).toBeGreaterThanOrEqual(4.18);
  });
});

describe("contrastRatio", () => {
  it("同じ色どうしは 1", () => {
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("白と黒は 21", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 1);
  });

  it("引数の順を入れ替えても同じ値になる", () => {
    expect(contrastRatio("#241b12", "#f2e9d6")).toBeCloseTo(contrastRatio("#f2e9d6", "#241b12"), 10);
  });
});
