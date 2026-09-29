import { expect, type Page, test } from "@playwright/test";
import { logOut, signUp } from "./helpers";

/** "api" キャッシュに、消えたかを見分けるための 1 件を置く */
async function seedApiCacheMarker(page: Page) {
  await page.evaluate(async () => {
    const cache = await caches.open("api");
    await cache.put("/api/e2e-marker", new Response("x"));
  });
}

/** 上のマーカーが、まだ "api" キャッシュに残っているか */
async function apiCacheMarkerExists(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const cache = await caches.open("api");
    return Boolean(await cache.match("/api/e2e-marker"));
  });
}

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("/api/reset を開くと、Cache Storage が消えて「/」に戻る。ログインしたまま。F-42、0089", async ({ page }) => {
  await seedApiCacheMarker(page);
  expect(await apiCacheMarkerExists(page)).toBe(true);

  await page.goto("/api/reset");
  await expect(page.getByText("最新の版にしています")).toBeVisible();
  await page.waitForURL("/");

  // ログインしたまま、カレンダーが直接開く。ログインへ移されない
  await expect(page.getByRole("region", { name: "月の表" }).or(page.getByTestId("today-day-number"))).toBeVisible();
  expect(await apiCacheMarkerExists(page)).toBe(false);
});

test("設定の「アプリを最新にする」も、同じことをする", async ({ page }) => {
  await page.goto("/settings/usage");
  await seedApiCacheMarker(page);
  expect(await apiCacheMarkerExists(page)).toBe(true);

  await expect(page.getByText(/いまの版/)).toBeVisible();
  await page.getByRole("button", { name: "アプリを最新にする" }).click();
  await page.waitForURL("/");

  await expect(page.getByRole("region", { name: "月の表" }).or(page.getByTestId("today-day-number"))).toBeVisible();
  expect(await apiCacheMarkerExists(page)).toBe(false);
});

test("ログアウトすると、前の人の api のキャッシュを消す", async ({ page }) => {
  await seedApiCacheMarker(page);
  expect(await apiCacheMarkerExists(page)).toBe(true);
  await logOut(page);
  expect(await apiCacheMarkerExists(page)).toBe(false);
});

test("サーバーの版が違うまま確かめ続けると、全部消して読み直す。F-42、0089", async ({ page }) => {
  await expect(page.getByRole("region", { name: "月の表" }).or(page.getByTestId("today-day-number"))).toBeVisible();

  // /api/version をここから先だけ、違う版に差し替える
  await page.context().route("**/api/version", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ version: "e2e-mismatch" }),
    }),
  );
  const readCount = () =>
    page.evaluate(() => Number(sessionStorage.getItem("logru:pwa-version-mismatch-count") ?? "0"));

  // 「アプリに戻ってきた」を装う。MAX_MISMATCH_CHECKS(pwa-version-check.ts、0089)は 3 回なので、
  // 2 回まではまだ Service Worker に確かめさせるだけで、読み込み直さない
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect.poll(readCount).toBe(i + 1);
  }
  await expect(page.getByRole("region", { name: "月の表" }).or(page.getByTestId("today-day-number"))).toBeVisible();

  // ここに残っていることが、まだ読み込み直していない証。次の 3 回目で全部消して読み直る
  await page.evaluate(() => {
    (window as unknown as { __beforeReset: boolean }).__beforeReset = true;
  });
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  // 消すのに手間取っても、CLEAR_TIMEOUT_MS(pwa-reset.ts、0089)を過ぎれば諦めて読み込み直す
  await expect
    .poll(
      async () => {
        try {
          return await page.evaluate(() => (window as unknown as { __beforeReset?: boolean }).__beforeReset);
        } catch {
          // 読み込み直る途中で、いまの document が失われて例外が起きることがある
          return undefined;
        }
      },
      { timeout: 10_000 },
    )
    .toBeUndefined();
  await expect(page.getByRole("region", { name: "月の表" }).or(page.getByTestId("today-day-number"))).toBeVisible();
});
