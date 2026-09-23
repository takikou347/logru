import { expect, test } from "@playwright/test";
import { addEvent, signUp } from "./helpers";

// ヘッドレスの Chrome は端末によって WebGL の有無が変わる。E2E はいつも平らな年の表の道筋を通す。0051
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signUp(page);
});

test("月の表の年を押すと、その年をらせんで見る画面が開く。F-39", async ({ page }) => {
  const year = new Date().getFullYear();
  await page.getByRole("link", { name: `${year} 年を、らせんで見る` }).click();
  await expect(page).toHaveURL(new RegExp(`/spiral/${year}$`));
  await expect(page.getByRole("region", { name: `${year} 年の表` })).toBeVisible();
  await expect(page.getByRole("heading", { name: "1 月", exact: true })).toBeVisible();
});

test("予定の色の点がその日に出て、押すとその日のカレンダーへ移る。F-39", async ({ page }) => {
  await addEvent(page, "歯医者");
  const today = new Date();
  const label = `${today.getMonth() + 1} 月 ${today.getDate()} 日`;

  await page.goto(`/spiral/${today.getFullYear()}`);
  const day = page.getByRole("link", { name: label, exact: true });
  await expect(day.locator(".swatch-dot")).toBeVisible();

  await day.click();
  await expect(page).toHaveURL(/\/\?date=\d{4}-\d{2}-\d{2}&view=day/);
  await expect(page.getByRole("button", { name: /歯医者/ })).toBeVisible();
});

test("前後の年に移れ、閉じるとカレンダーへ戻る。F-39", async ({ page }) => {
  const year = new Date().getFullYear();
  await page.goto(`/spiral/${year}`);

  await page.getByRole("link", { name: "次の年" }).click();
  await expect(page).toHaveURL(new RegExp(`/spiral/${year + 1}$`));

  await page.getByRole("link", { name: "前の年" }).click();
  await page.getByRole("link", { name: "前の年" }).click();
  await expect(page).toHaveURL(new RegExp(`/spiral/${year - 1}$`));

  await page.getByRole("button", { name: "カレンダーへ戻る" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();
});

test("動きを減らす設定では、平らな年の表を選ぶボタンが出ない。F-39", async ({ page }) => {
  const year = new Date().getFullYear();
  await page.goto(`/spiral/${year}`);
  await expect(page.getByRole("button", { name: "らせんで見る" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "平らな表で見る" })).toHaveCount(0);
});
