import { describe, expect, it } from "vitest";
import {
  detectInAppBrowser,
  externalBrowserRedirectUrl,
  withoutExternalBrowserParam,
} from "../../src/client/lib/in-app-browser";

const UA = {
  line: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.15.0",
  instagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 302.0.0.0.0",
  facebook:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0]",
  x: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Twitter for Android",
  safari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
};

describe("アプリ内のブラウザーの見分け。#126", () => {
  it("LINE は line", () => {
    expect(detectInAppBrowser(UA.line)).toBe("line");
  });

  it("Instagram、Facebook、X は other", () => {
    expect(detectInAppBrowser(UA.instagram)).toBe("other");
    expect(detectInAppBrowser(UA.facebook)).toBe("other");
    expect(detectInAppBrowser(UA.x)).toBe("other");
  });

  it("Safari と Chrome はどちらでもない", () => {
    expect(detectInAppBrowser(UA.safari)).toBe(null);
    expect(detectInAppBrowser(UA.androidChrome)).toBe(null);
  });
});

describe("LINE を外のブラウザーで開き直す先。#126", () => {
  it("LINE の中で、まだ開き直していなければ引数を足した URL を返す", () => {
    const url = externalBrowserRedirectUrl(UA.line, "https://logru.example/login?next=%2F");
    expect(url).toBe("https://logru.example/login?next=%2F&openExternalBrowser=1");
  });

  it("引数が付いているのにまだ LINE の中なら、開き直さない。行き来を防ぐ", () => {
    const url = externalBrowserRedirectUrl(UA.line, "https://logru.example/login?openExternalBrowser=1");
    expect(url).toBe(null);
  });

  it("LINE 以外では開き直さない", () => {
    expect(externalBrowserRedirectUrl(UA.instagram, "https://logru.example/login")).toBe(null);
    expect(externalBrowserRedirectUrl(UA.safari, "https://logru.example/login")).toBe(null);
  });

  it("招待の URL でも開き直す", () => {
    const url = externalBrowserRedirectUrl(UA.line, "https://logru.example/invite/abc123");
    expect(url).toBe("https://logru.example/invite/abc123?openExternalBrowser=1");
  });
});

describe("外のブラウザーで開いた後、URL から印を消す。#126", () => {
  it("印が付いていれば消す", () => {
    const url = withoutExternalBrowserParam("https://logru.example/login?next=%2F&openExternalBrowser=1");
    expect(url).toBe("https://logru.example/login?next=%2F");
  });

  it("印が無ければ null", () => {
    expect(withoutExternalBrowserParam("https://logru.example/login")).toBe(null);
  });
});
