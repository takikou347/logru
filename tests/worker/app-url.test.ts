import { describe, expect, it } from "vitest";
import { isLocalDev, resolveAppUrl } from "@server/core/app";

const dev = { ENVIRONMENT: "development", APP_URL: "http://localhost:5173" } as never;
const prod = { ENVIRONMENT: "production", APP_URL: "https://logru.example.com" } as never;

describe("isLocalDev", () => {
  it("開発の設定で、localhost からの要求だけを手元の開発とみなす", () => {
    expect(isLocalDev(dev, "http://localhost:4173/api/me")).toBe(true);
    expect(isLocalDev(dev, "http://127.0.0.1:5173/api/me")).toBe(true);
  });

  it("開発の設定のまま公開しても、外からの要求は開発とみなさない", () => {
    expect(isLocalDev(dev, "https://logru.example.workers.dev/api/me")).toBe(false);
  });

  it("本番の設定では、localhost からでも開発とみなさない", () => {
    expect(isLocalDev(prod, "http://localhost:5173/api/me")).toBe(false);
  });
});

describe("resolveAppUrl", () => {
  it("手元では要求の出どころを使い、本番では APP_URL に固定する", () => {
    expect(resolveAppUrl(dev, "http://localhost:4173/api/me")).toBe("http://localhost:4173");
    expect(resolveAppUrl(dev, "https://attacker.example/api/me")).toBe("http://localhost:5173");
    expect(resolveAppUrl(prod, "https://evil.example/api/me")).toBe("https://logru.example.com");
  });
});
