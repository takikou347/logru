import { expect, test } from "@playwright/test";
import { dayPanel, signUp } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("PC では左にメニュー、右に選んだ日の予定を出し、下の操作は出さない", async ({ page }) => {
  await expect(page.getByRole("complementary", { name: "メニュー" })).toBeVisible();
  await expect(dayPanel(page)).toBeVisible();
  await expect(page.getByRole("toolbar", { name: "カレンダーの操作" })).toBeHidden();
  await expect(page.getByRole("button", { name: "メニューを開く" })).toBeHidden();
});

test("N で予定を足すシートが開き、左右の矢印で月を移り、T で今日に戻る", async ({ page }) => {
  const month = page.getByTestId("month-number");
  const before = await month.textContent();
  await page.keyboard.press("ArrowRight");
  await expect(month).not.toHaveText(before!);
  await page.keyboard.press("t");
  await expect(month).toHaveText(before!);
  await page.keyboard.press("n");
  await expect(page.getByRole("dialog", { name: "新しい予定" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("PC ではマスに予定名が出て、押すと直すシートが開く", async ({ page }) => {
  await page.getByRole("button", { name: "予定を足す" }).first().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await sheet.getByLabel("題名").fill("打ち合わせ");
  await sheet.getByRole("button", { name: "保存する" }).click();
  const chip = page.getByRole("region", { name: "月の表" }).getByRole("button", { name: /打ち合わせ/ });
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(page.getByRole("dialog", { name: "予定を直す" })).toBeVisible();
});
