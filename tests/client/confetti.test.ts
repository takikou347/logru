import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONFETTI_COUNT,
  CONFETTI_MS,
  confettiShown,
  fadeAt,
  makeParticles,
  markConfettiShown,
  reducedMotionNow,
  stepParticle,
} from "../../src/client/lib/confetti";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubStorage(store: Record<string, string>) {
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
  });
}

describe("紙吹雪の印。F-49、0098", () => {
  it("同じ日は 1 度出したら 2 回目を出さず、別の日は出す", () => {
    stubStorage({});
    expect(confettiShown("2026-10-12")).toBe(false);
    markConfettiShown("2026-10-12");
    expect(confettiShown("2026-10-12")).toBe(true);
    expect(confettiShown("2026-10-13")).toBe(false);
  });

  it("localStorage が使えなくても落ちない", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });
    expect(confettiShown("2026-10-12")).toBe(false);
    expect(() => markConfettiShown("2026-10-12")).not.toThrow();
  });
});

describe("動きを減らす設定。F-49", () => {
  it("OS が動きを減らす設定のときだけ true", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    expect(reducedMotionNow()).toBe(true);
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
    expect(reducedMotionNow()).toBe(false);
  });
});

describe("粒の動き", () => {
  it("決めた数だけ、画面の上の外から始まる", () => {
    const ps = makeParticles(() => 0.5);
    expect(ps).toHaveLength(CONFETTI_COUNT);
    expect(ps.every((p) => p.y < 0)).toBe(true);
  });

  it("進めると下へ落ちる", () => {
    const [p] = makeParticles(() => 0.5);
    if (!p) throw new Error("no particle");
    expect(stepParticle(p, 0.1).y).toBeGreaterThan(p.y);
  });

  it("終わり際だけ薄くなり、終わりで 0", () => {
    expect(fadeAt(0)).toBe(1);
    expect(fadeAt(CONFETTI_MS - 150)).toBeCloseTo(0.5);
    expect(fadeAt(CONFETTI_MS)).toBe(0);
  });
});
