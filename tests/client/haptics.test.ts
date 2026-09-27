import { afterEach, describe, expect, it, vi } from "vitest";
import { vibrateShort } from "../../src/client/lib/haptics";

/** matchMedia を差し替える。動きを減らす設定だけ動かす */
function stubWindow(reducedMotion: boolean) {
  vi.stubGlobal("window", {
    matchMedia: (query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? reducedMotion : false,
      media: query,
    }),
  });
}

describe("vibrateShort。#112", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("navigator.vibrate が使えて、動きを減らしていなければ震える", () => {
    stubWindow(false);
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { vibrate });
    vibrateShort();
    expect(vibrate).toHaveBeenCalledOnce();
  });

  it("動きを減らしているときは震えない", () => {
    stubWindow(true);
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { vibrate });
    vibrateShort();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("navigator.vibrate が無い端末では、呼んでも落ちない", () => {
    stubWindow(false);
    vi.stubGlobal("navigator", {});
    expect(() => vibrateShort()).not.toThrow();
  });
});
