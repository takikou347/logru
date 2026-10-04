import { describe, expect, it } from "vitest";
import { tiltOffset } from "../../src/client/lib/use-device-tilt";
import { starParallaxEnabled, starVars } from "../../src/client/lib/use-star-parallax";

describe("starParallaxEnabled。夜空の星の視差。#279", () => {
  it("夜空で、動きを減らさず、タッチ端末なら動かす", () => {
    expect(starParallaxEnabled({ look: "night", reduced: false, touch: true })).toBe(true);
  });
  it("動きを減らしているときは動かさない", () => {
    expect(starParallaxEnabled({ look: "night", reduced: true, touch: true })).toBe(false);
  });
  it("PC(タッチでない)では動かさない", () => {
    expect(starParallaxEnabled({ look: "night", reduced: false, touch: false })).toBe(false);
  });
  it("夜空以外のテーマでは動かさない", () => {
    expect(starParallaxEnabled({ look: "glass", reduced: false, touch: true })).toBe(false);
    expect(starParallaxEnabled({ look: undefined, reduced: false, touch: true })).toBe(false);
  });
});

describe("starVars", () => {
  it("動かさないときは 0px", () => {
    expect(starVars(false, tiltOffset(90, 90))).toEqual({ x: "0px", y: "0px" });
  });
  it("大きく傾けても、上限の 6px まで", () => {
    expect(starVars(true, tiltOffset(180, 90))).toEqual({ x: "6px", y: "6px" });
    expect(starVars(true, tiltOffset(-180, -90))).toEqual({ x: "-6px", y: "-6px" });
  });
});
