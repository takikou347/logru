import { describe, expect, it } from "vitest";
import { tiltOffset } from "../../src/client/lib/use-device-tilt";

describe("tiltOffset。今日のカードの奥行き。最大 6px。#112", () => {
  it("真ん中(0 度)ならずらさない", () => {
    expect(tiltOffset(0, 0)).toEqual({ x: 0, y: 0 });
  });

  it("値が無ければ(null)、0 度として扱う", () => {
    expect(tiltOffset(null, null)).toEqual({ x: 0, y: 0 });
  });

  it("大きく傾けても、最大 6px までしかずらさない", () => {
    const offset = tiltOffset(180, 90);
    expect(offset.y).toBe(6);
    expect(offset.x).toBe(6);
  });

  it("逆に傾けると、逆向きに最大 -6px までずれる", () => {
    const offset = tiltOffset(-180, -90);
    expect(offset.y).toBe(-6);
    expect(offset.x).toBe(-6);
  });

  it("傾きが増えるほど、ずれも大きくなる", () => {
    const small = tiltOffset(0, 5);
    const big = tiltOffset(0, 15);
    expect(big.x).toBeGreaterThan(small.x);
  });
});
