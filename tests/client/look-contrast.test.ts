import { describe, expect, it } from "vitest";
import { contrastRatio } from "../../src/client/lib/contrast";

/**
 * 見た目の土台「紙」のトークンの、文字と地の比。0090、F-43
 *
 * 値は src/client/styles/tokens.css の `[data-look="paper"]` の節と合わせる。
 * tokens.css の値を変えたら、ここも合わせて直す。
 */
const PAPER_LIGHT = { ground: "#f2e9d6", panel: "#f6eeda", ink: "#241b12", ink2: "#6e5c42", ink3: "#7c6c52" };
const PAPER_DARK = { ground: "#1c1712", panel: "#201a14", ink: "#ece4d3", ink2: "#b8a98e", ink3: "#8f8268" };

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
