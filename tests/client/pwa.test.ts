import { describe, expect, it } from "vitest";
import {
  BANNER_SNOOZE_DAYS,
  detectPlatform,
  isStandalone,
  needsInstallForPush,
  shouldShowInstallBanner,
} from "../../src/client/lib/pwa";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.46 Mobile/15E148 Safari/604.1",
  iphoneLine:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.15.0",
  ipadSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
  macChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  windowsEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0",
};

describe("端末の見分け。F-34", () => {
  it("iPhone の Safari", () => {
    expect(detectPlatform(UA.iphoneSafari, 5)).toBe("ios-safari");
  });

  it("iPhone の Safari 以外。Chrome と、アプリの中のブラウザー", () => {
    expect(detectPlatform(UA.iphoneChrome, 5)).toBe("ios-other");
    expect(detectPlatform(UA.iphoneLine, 5)).toBe("ios-other");
  });

  it("iPad の Safari は Mac と同じ UA を出す。触れるかで見分ける", () => {
    expect(detectPlatform(UA.ipadSafari, 5)).toBe("ios-safari");
    expect(detectPlatform(UA.ipadSafari, 0)).toBe("desktop");
  });

  it("Android", () => {
    expect(detectPlatform(UA.androidChrome, 5)).toBe("android");
  });

  it("PC", () => {
    expect(detectPlatform(UA.macChrome, 0)).toBe("desktop");
    expect(detectPlatform(UA.windowsEdge, 10)).toBe("desktop");
  });
});

describe("ホーム画面から開いているか", () => {
  it("display-mode か、iOS の navigator.standalone のどちらかで分かる", () => {
    expect(isStandalone(true, undefined)).toBe(true);
    expect(isStandalone(false, true)).toBe(true);
    expect(isStandalone(false, false)).toBe(false);
    expect(isStandalone(false, undefined)).toBe(false);
  });
});

describe("上の帯を出すか", () => {
  const now = Date.UTC(2026, 8, 23);
  const base = { platform: "ios-safari" as const, standalone: false, dismissedAt: null, now, canPrompt: false };
  const day = 24 * 60 * 60 * 1000;

  it("iPhone のブラウザーで開いていれば出す", () => {
    expect(shouldShowInstallBanner(base)).toBe(true);
    expect(shouldShowInstallBanner({ ...base, platform: "ios-other" })).toBe(true);
  });

  it("ホーム画面から開いていれば出さない", () => {
    expect(shouldShowInstallBanner({ ...base, standalone: true })).toBe(false);
  });

  it("PC では出さない", () => {
    expect(shouldShowInstallBanner({ ...base, platform: "desktop" })).toBe(false);
  });

  it("Android は、追加のダイアログを出せるときだけ出す", () => {
    expect(shouldShowInstallBanner({ ...base, platform: "android" })).toBe(false);
    expect(shouldShowInstallBanner({ ...base, platform: "android", canPrompt: true })).toBe(true);
  });

  it("閉じたら 30 日は出さない", () => {
    expect(shouldShowInstallBanner({ ...base, dismissedAt: now - day })).toBe(false);
    expect(shouldShowInstallBanner({ ...base, dismissedAt: now - (BANNER_SNOOZE_DAYS - 1) * day })).toBe(false);
    expect(shouldShowInstallBanner({ ...base, dismissedAt: now - BANNER_SNOOZE_DAYS * day })).toBe(true);
  });
});

describe("知らせの欄で、先にホーム画面に追加するよう案内するか。0023", () => {
  it("iPhone でブラウザーから開いているときだけ", () => {
    expect(needsInstallForPush("ios-safari", false)).toBe(true);
    expect(needsInstallForPush("ios-other", false)).toBe(true);
    expect(needsInstallForPush("ios-safari", true)).toBe(false);
    expect(needsInstallForPush("android", false)).toBe(false);
    expect(needsInstallForPush("desktop", false)).toBe(false);
  });
});
