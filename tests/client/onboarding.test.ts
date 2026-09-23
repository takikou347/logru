import { describe, expect, it } from "vitest";
import { inviteTokenOf, shouldShowOnboarding } from "../../src/client/modules/onboarding/model";

describe("はじめての案内。F-32", () => {
  it("見終えていなければ出し、見終えたら出さない。設定から開き直したときは出す", () => {
    expect(shouldShowOnboarding(null, false)).toBe(true);
    expect(shouldShowOnboarding(1_700_000_000_000, false)).toBe(false);
    expect(shouldShowOnboarding(1_700_000_000_000, true)).toBe(true);
  });

  it("貼られた招待リンクから、招待の文字列を取り出す", () => {
    const token = "AbCdEfGhIjKlMnOpQrStUvWxYz012345";
    expect(inviteTokenOf(`https://logru.example/invite/${token}`)).toBe(token);
    expect(inviteTokenOf(`  /invite/${token}/  `)).toBe(token);
    expect(inviteTokenOf(`https://logru.example/invite/${token}?from=line`)).toBe(token);
  });

  it("招待リンクでなければ null", () => {
    expect(inviteTokenOf("")).toBeNull();
    expect(inviteTokenOf("https://logru.example/groups/abc")).toBeNull();
    expect(inviteTokenOf("https://logru.example/invite/short")).toBeNull();
  });
});
