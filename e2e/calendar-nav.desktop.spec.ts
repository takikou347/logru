import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

/** PC の矢印ボタンとキーも、月送りの日めくりの動きを再生する。#99、0049 */

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("次の月ボタンでも、同じめくりのしくみで月が進む", async ({ page }) => {
  const monthNumber = page.getByTestId("month-number");
  const before = Number(await monthNumber.innerText());
  await page.getByRole("button", { name: "次の月" }).click();
  await expect(monthNumber).toHaveText(((before % 12) + 1).toString());

  const transform = await page.getByRole("region", { name: "月の表" }).evaluate((el) => getComputedStyle(el).transform);
  expect(transform).toBe("none");
});

test("左右のキーでも月が進む", async ({ page }) => {
  const monthNumber = page.getByTestId("month-number");
  const before = Number(await monthNumber.innerText());
  await page.keyboard.press("ArrowRight");
  await expect(monthNumber).toHaveText(((before % 12) + 1).toString());
  await page.keyboard.press("ArrowLeft");
  await expect(monthNumber).toHaveText(String(before));
});
