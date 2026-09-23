import { isFirebaseAuthPath, proxyFirebaseAuth } from "@server/core/auth/firebase-proxy";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("isFirebaseAuthPath", () => {
  it("ログインの窓と iframe を中継する", () => {
    expect(isFirebaseAuthPath("/__/auth/handler")).toBe(true);
    expect(isFirebaseAuthPath("/__/auth/iframe")).toBe(true);
  });

  it("ほかの道は中継しない", () => {
    expect(isFirebaseAuthPath("/")).toBe(false);
    expect(isFirebaseAuthPath("/api/me")).toBe(false);
    expect(isFirebaseAuthPath("/__/auth")).toBe(false);
    expect(isFirebaseAuthPath("/__/firebase/init.json")).toBe(false);
  });
});

describe("proxyFirebaseAuth", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("道と問い合わせをそのまま、プロジェクトの firebaseapp.com へ渡す", async () => {
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const res = await proxyFirebaseAuth(
      new Request("https://logru.example.workers.dev/__/auth/handler?apiKey=k&authType=signInViaPopup"),
      "logru-test",
    );
    expect(await res.text()).toBe("ok");
    const [sent, init] = fetchMock.mock.calls[0] as unknown as [Request, RequestInit];
    expect(sent.url).toBe("https://logru-test.firebaseapp.com/__/auth/handler?apiKey=k&authType=signInViaPopup");
    expect(init.redirect).toBe("manual");
  });
});
