import { pwaRoutes } from "@server/modules/pwa/routes";
import { describe, expect, it } from "vitest";

describe("GET /api/reset。表示が古いままの人が直す画面。ログインは求めない。F-42、0089", () => {
  it("HTML を no-store で返し、/api/reset.js を読む", async () => {
    const res = await pwaRoutes.request("/reset");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = await res.text();
    expect(html).toContain('<script src="/api/reset.js">');
    expect(html).toContain("最新の版にしています");
  });
});

describe("GET /api/reset.js。Service Worker の登録と Cache Storage を全部消す。F-42、0089", () => {
  it("JavaScript として no-store で返す", async () => {
    const res = await pwaRoutes.request("/reset.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("javascript");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const script = await res.text();
    expect(script).toContain("getRegistrations");
    expect(script).toContain("caches.keys");
    expect(script).toContain('location.replace("/")');
    // ログインの状態(IndexedDB)と端末の設定(localStorage)には触れない
    expect(script).not.toContain("indexedDB");
    expect(script).not.toContain("localStorage");
  });
});

describe("GET /api/version。版の食い違いを画面が確かめる元。F-42、0089", () => {
  it("組み立ての版を no-store で返す", async () => {
    const res = await pwaRoutes.request("/version");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as { version: string };
    expect(typeof body.version).toBe("string");
    expect(body.version.length).toBeGreaterThan(0);
  });
});
