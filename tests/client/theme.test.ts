import { beforeEach, describe, expect, it, vi } from "vitest";
import { readStoredTheme } from "../../src/client/lib/theme";

/** 端末の matchMedia を差し替える。透明度を下げる設定だけ動かす */
function stubMatchMedia(reducedTransparency: boolean) {
  vi.stubGlobal("window", {
    matchMedia: (query: string) => ({
      matches: query.includes("prefers-reduced-transparency") ? reducedTransparency : false,
      media: query,
    }),
  });
}

describe("readStoredTheme の背景のテーマの既定。#95", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });

  it("保存が無く、端末の透明度を下げる設定が有効なら、既定を平らにする", () => {
    stubMatchMedia(true);
    expect(readStoredTheme().bgTheme).toBe("flat");
  });

  it("保存が無く、端末の透明度を下げる設定が無効なら、既定はガラスのまま", () => {
    stubMatchMedia(false);
    expect(readStoredTheme().bgTheme).toBe("glass");
  });

  it("保存済みの値があれば、端末の透明度を下げる設定に関わらずそちらを使う", () => {
    stubMatchMedia(true);
    localStorage.setItem("logru-theme", JSON.stringify({ mode: "system", bgTheme: "glass", accent: "aizumi" }));
    expect(readStoredTheme().bgTheme).toBe("glass");
  });
});
