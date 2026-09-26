import { expect, test } from "@playwright/test";
import { addExtension, signUp } from "./helpers";

/**
 * 支出と予定のシートが、開いた時点で「保存する」が画面の中にあるか。
 * ResponsiveSheet の footer(#192)を確かめる。
 */
test.use({ viewport: { width: 390, height: 844 } });

test("家計簿の記録のシートを開くと、保存するが画面の中に見える", async ({ page }) => {
  await signUp(page);
  await addExtension(page, "家計簿");
  await page.goto("/kakeibo");
  await page.getByRole("toolbar", { name: "家計簿の操作" }).getByRole("button", { name: "支出を記録する" }).click();
  const sheet = page.getByRole("dialog", { name: "記録する" });
  await expect(sheet).toBeVisible();

  const save = sheet.getByRole("button", { name: "保存する" });
  await expect(save).toBeInViewport();
});

test("新しい予定のシートを開くと、保存するが画面の中に見える", async ({ page }) => {
  await signUp(page);
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await expect(sheet).toBeVisible();

  const save = sheet.getByRole("button", { name: "保存する" });
  await expect(save).toBeInViewport();
});

test("開く動きは 320ms 以下で、既定の 500ms より速い", async ({ page }) => {
  await signUp(page);
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await expect(sheet).toBeVisible();

  const duration = await sheet.evaluate((el) => getComputedStyle(el).animationDuration);
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.32);
});

test("動きを減らす設定では、開閉の動きが出ない", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signUp(page);
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await expect(sheet).toBeVisible();

  const duration = await sheet.evaluate((el) => getComputedStyle(el).animationDuration);
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.001);

  // 閉じるときも同じく、ほぼ 0 の動きになる
  await sheet.getByRole("button", { name: "やめる" }).click();
  await expect(sheet).toBeHidden();
});

test("やめるを押すと、閉じる動きが出てから消える", async ({ page }) => {
  await signUp(page);
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await expect(sheet).toBeVisible();

  await sheet.getByRole("button", { name: "やめる" }).click();
  // 消える前に、閉じる動きの状態(data-state=closed)を通る
  await expect(sheet).toHaveAttribute("data-state", "closed");
  await expect(sheet).toBeHidden();
});
