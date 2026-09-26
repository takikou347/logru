import { expect, test } from "@playwright/test";
import { addExtension, signUp } from "./helpers";

/** PC(1280x800)でも、開いた時点で「保存する」が画面の中にあるか。ResponsiveSheet の footer(#192) */
test.use({ viewport: { width: 1280, height: 800 } });

test("PC で家計簿の記録のシートを開くと、保存するが画面の中に見える", async ({ page }) => {
  await signUp(page);
  await addExtension(page, "家計簿");
  await page.goto("/kakeibo");
  // PC は下の帯(Dock)を隠し、見出しの帯(PageBar の action)から記録する。同じ名前のボタンが
  // 空の月の案内にもあるが、見出しの帯の方が先に出るので先頭を取る。issue #202
  await page.getByRole("button", { name: "支出を記録する" }).first().click();
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
