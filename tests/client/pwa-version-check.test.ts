import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkVersion, decideVersionAction, MAX_MISMATCH_CHECKS } from "../../src/client/lib/pwa-version-check";

vi.mock("../../src/client/lib/pwa-reset", () => ({ hardResetAndReload: vi.fn() }));

describe("decideVersionAction。版の食い違いを見つけて、次にすることを決める。F-42、0089", () => {
  it("版が同じなら何もしない", () => {
    expect(decideVersionAction("abc1234", "abc1234", 0)).toBe("ok");
  });

  it("サーバーの版が読めなければ何もしない", () => {
    expect(decideVersionAction("abc1234", null, 0)).toBe("ok");
  });

  it("版が違えば、まだ確かめ続けた回数が少ないうちは Service Worker に確かめさせる", () => {
    expect(decideVersionAction("abc1234", "def5678", 0)).toBe("update");
    expect(decideVersionAction("abc1234", "def5678", MAX_MISMATCH_CHECKS - 2)).toBe("update");
  });

  it(`版が違うまま ${MAX_MISMATCH_CHECKS} 回目になったら、全部消して読み直す`, () => {
    expect(decideVersionAction("abc1234", "def5678", MAX_MISMATCH_CHECKS - 1)).toBe("reset");
    expect(decideVersionAction("abc1234", "def5678", MAX_MISMATCH_CHECKS)).toBe("reset");
  });
});

describe("checkVersion。/api/version を読み、確かめ続けた回数を sessionStorage に持つ。F-42、0089", () => {
  const store = new Map<string, string>();
  const sessionStorageMock = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  };
  const update = vi.fn().mockResolvedValue(undefined);
  const getRegistration = vi.fn().mockResolvedValue({ update });
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("sessionStorage", sessionStorageMock);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { serviceWorker: { getRegistration } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    update.mockReset().mockResolvedValue(undefined);
    getRegistration.mockReset().mockResolvedValue({ update });
  });

  it("版が同じなら Service Worker には何もさせない", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ version: "test" }), { status: 200 }));
    await checkVersion();
    expect(update).not.toHaveBeenCalled();
    expect(store.get("logru:pwa-version-mismatch-count")).toBeUndefined();
  });

  it("版が違えば registration.update() を呼び、回数を 1 増やす", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ version: "other" }), { status: 200 }));
    await checkVersion();
    expect(update).toHaveBeenCalledTimes(1);
    expect(store.get("logru:pwa-version-mismatch-count")).toBe("1");
  });

  it("読めなければ何もしない", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    await checkVersion();
    expect(update).not.toHaveBeenCalled();
  });

  it(`${MAX_MISMATCH_CHECKS} 回目まで版が合わなければ、全部消して読み直し、回数を戻す`, async () => {
    const { hardResetAndReload } = await import("../../src/client/lib/pwa-reset");
    // Response の本文は 1 度しか読めないので、呼ぶたびに新しく作る
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ version: "other" }), { status: 200 }));
    for (let i = 0; i < MAX_MISMATCH_CHECKS - 1; i++) await checkVersion();
    expect(hardResetAndReload).not.toHaveBeenCalled();
    await checkVersion();
    expect(hardResetAndReload).toHaveBeenCalledTimes(1);
    expect(store.get("logru:pwa-version-mismatch-count")).toBeUndefined();
  });

  it("版が戻れば、確かめ続けた回数を 0 に戻す", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ version: "other" }), { status: 200 }));
    await checkVersion();
    expect(store.get("logru:pwa-version-mismatch-count")).toBe("1");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ version: "test" }), { status: 200 }));
    await checkVersion();
    expect(store.get("logru:pwa-version-mismatch-count")).toBeUndefined();
  });
});
