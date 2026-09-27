import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearServiceWorkerAndCaches, hardResetAndReload } from "../../src/client/lib/pwa-reset";

describe("clearServiceWorkerAndCaches。Service Worker の登録と Cache Storage を全部消す。F-42、0089", () => {
  const unregister1 = vi.fn().mockResolvedValue(undefined);
  const unregister2 = vi.fn().mockResolvedValue(undefined);
  const getRegistrations = vi.fn().mockResolvedValue([{ unregister: unregister1 }, { unregister: unregister2 }]);
  const deleteCache = vi.fn().mockResolvedValue(true);
  const keys = vi.fn().mockResolvedValue(["api", "workbox-precache"]);

  beforeEach(() => {
    vi.stubGlobal("navigator", { serviceWorker: { getRegistrations } });
    vi.stubGlobal("caches", { keys, delete: deleteCache });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("登録をすべて外し、キャッシュをすべて消す", async () => {
    await clearServiceWorkerAndCaches();
    expect(unregister1).toHaveBeenCalledTimes(1);
    expect(unregister2).toHaveBeenCalledTimes(1);
    expect(deleteCache).toHaveBeenCalledWith("api");
    expect(deleteCache).toHaveBeenCalledWith("workbox-precache");
  });
});

describe("hardResetAndReload。消してから「/」へ移る。失敗しても必ず移る", () => {
  const replace = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("navigator", { serviceWorker: { getRegistrations: vi.fn().mockRejectedValue(new Error("boom")) } });
    vi.stubGlobal("window", { location: { replace, pathname: "/settings/usage", search: "", hash: "" } });
    vi.stubGlobal("caches", undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    replace.mockReset();
  });

  it("消すのに失敗しても「/」へ移る", async () => {
    await expect(hardResetAndReload()).rejects.toThrow();
    expect(replace).toHaveBeenCalledWith("/");
  });
});

describe("hardResetAndReload。すでに「/」にいるときは読み込み直す。0089", () => {
  const reload = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("navigator", { serviceWorker: { getRegistrations: vi.fn().mockResolvedValue([]) } });
    vi.stubGlobal("window", { location: { reload, pathname: "/", search: "", hash: "" } });
    vi.stubGlobal("caches", undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    reload.mockReset();
  });

  it('location.replace("/") では同じ URL のままなことがあるので、reload を呼ぶ', async () => {
    await hardResetAndReload();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
