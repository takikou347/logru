import { expect, test } from "@playwright/test";

/** LINE が UA に含める印を持つ、iPhone の LINE の UA */
const LINE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.15.0";
/** Instagram の中のブラウザーの UA。LINE 以外のアプリ内のブラウザーの例 */
const INSTAGRAM_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 302.0.0.0.0";

test.describe("LINE の中で開くと、外のブラウザーで開き直す。#126", () => {
  test.use({ userAgent: LINE_UA });

  test("ログインの URL は、openExternalBrowser=1 を足して開き直る", async ({ page }) => {
    await page.goto("/login?next=%2F").catch(() => {});
    await expect(page).toHaveURL(/\/login\?next=%2F&openExternalBrowser=1$/);
  });

  test("招待の URL も、ログインの画面だけに絞らず開き直る", async ({ page }) => {
    await page.goto("/invite/sample-token").catch(() => {});
    await expect(page).toHaveURL(/\/invite\/sample-token\?openExternalBrowser=1$/);
  });

  test("引数が付いているのにまだ LINE の UA のままなら、開き直さず案内を出す", async ({ page }) => {
    await page.goto("/login?openExternalBrowser=1");
    // URL はそのまま。もう一度 openExternalBrowser を足して開き直したりしない
    await expect(page).toHaveURL(/\/login\?openExternalBrowser=1$/);
    await expect(page.getByText("Safari か Chrome で開いてください。")).toBeVisible();
    await expect(page.getByRole("button", { name: "URL をコピーする" })).toBeVisible();
    // Google のボタンなど、いつもの画面もそのまま出る
    await expect(page.getByRole("button", { name: "Google でログイン" })).toBeVisible();

    // 読み込み直しても、開き直しの行き来が始まらない
    await page.reload();
    await expect(page).toHaveURL(/\/login\?openExternalBrowser=1$/);
    await expect(page.getByText("Safari か Chrome で開いてください。")).toBeVisible();
  });

  test("登録の画面でも、行き来が止まったときは同じ案内を出す", async ({ page }) => {
    await page.goto("/signup?openExternalBrowser=1");
    await expect(page).toHaveURL(/\/signup\?openExternalBrowser=1$/);
    await expect(page.getByText("Safari か Chrome で開いてください。")).toBeVisible();
  });
});

test.describe("LINE 以外のアプリ内のブラウザーでは、外で開く案内を出す。#126", () => {
  test.use({ userAgent: INSTAGRAM_UA });

  test("ログインの画面に、案内とコピーのボタンが出る", async ({ page }) => {
    await page.goto("/login");
    // 開き直しは起きない。URL に引数は付かない
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("Safari か Chrome で開いてください。")).toBeVisible();
    await expect(page.getByRole("button", { name: "URL をコピーする" })).toBeVisible();
  });

  test("登録の画面にも案内が出る", async ({ page }) => {
    await page.goto("/signup");
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByText("Safari か Chrome で開いてください。")).toBeVisible();
  });
});

test("いつもの Chrome では、開き直しも案内も起きない", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Safari か Chrome で開いてください。")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Google でログイン" })).toBeVisible();
});

test("外のブラウザーで開いた後は、URL から openExternalBrowser を消す", async ({ page }) => {
  await page.goto("/login?next=%2F&openExternalBrowser=1");
  await expect(page).toHaveURL(/\/login\?next=%2F$/);
  await expect(page.getByText("Safari か Chrome で開いてください。")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Google でログイン" })).toBeVisible();
});
