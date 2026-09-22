import { beforeEach, describe, expect, it, vi } from "vitest";
import { LEGAL_VERSIONS } from "../../src/shared/legal";
import { forgetAgreement, rememberAgreement, takeRememberedAgreement } from "../../src/client/modules/auth/pending-agreement";

describe("登録の画面で受けた同意", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });

  it("同じ人なら 1 度だけ取り出せる。大文字と空白は区別しない", () => {
    rememberAgreement("Kota@Example.com ");
    expect(takeRememberedAgreement("kota@example.com")).toBe(true);
    expect(takeRememberedAgreement("kota@example.com")).toBe(false);
  });

  it("別の人には使わせず、本人のために残す", () => {
    rememberAgreement("kota@example.com");
    expect(takeRememberedAgreement("other@example.com")).toBe(false);
    expect(takeRememberedAgreement("kota@example.com")).toBe(true);
  });

  it("規約の版が変わっていたら使わない", () => {
    localStorage.setItem(
      "logru-pending-agreement",
      JSON.stringify({ email: "kota@example.com", versions: { ...LEGAL_VERSIONS, terms: "2000-01-01" } }),
    );
    expect(takeRememberedAgreement("kota@example.com")).toBe(false);
  });

  it("登録に失敗して消したら使わない。アドレスが無ければ使わない", () => {
    rememberAgreement("kota@example.com");
    expect(takeRememberedAgreement(null)).toBe(false);
    forgetAgreement();
    expect(takeRememberedAgreement("kota@example.com")).toBe(false);
  });
});
