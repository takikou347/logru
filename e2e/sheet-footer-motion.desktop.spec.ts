import { expect, test } from "@playwright/test";
import { addExtension, signUp } from "./helpers";

/** PC(1280x800)でも、開いた時点で「保存する」が画面の中にあるか。ResponsiveSheet の footer(#192) */
test.use({ viewport: { width: 1280, height: 800 } });

test("PC で家計簿の記録のシートを開くと、保存するが画面の中に見える", async ({ page }) => {
  await signUp(page);
  await addExtension(page, "家計簿");
  await page.goto("/kakeibo");
  await page.getByRole("toolbar", { name: "家計簿の操作" }).getByRole("button", { name: "支出を記録する" }).click();
  const sheet = page.getByRole("dialog", { name: "記録する" });
  await expect(sheet).toBeVisible();

  const save = sheet.getByRole("button", { name: "保存する" });
  await expect(save).toBeInViewport();
});

test("PC で新しい予定のシートを開くと、保存するが画面の中に見える", async ({ page }) => {
  await signUp(page);
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await expect(sheet).toBeVisible();

  const save = sheet.getByRole("button", { name: "保存する" });
  await expect(save).toBeInViewport();
});
