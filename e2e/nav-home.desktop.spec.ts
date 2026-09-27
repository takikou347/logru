import { expect, test } from "@playwright/test";
import { addExtension, signUp } from "./helpers";

/** PC(1280x800)は左の列に道があるので、上の帯に家のボタンを出さない。issue #220 */
test.use({ viewport: { width: 1280, height: 800 } });

test("PC の口座ごとの記録では、家のボタンを出さない", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await addExtension(page, "家計簿");
  await page.goto("/kakeibo/accounts");
  await page.getByRole("toolbar", { name: "口座の操作" }).getByRole("button", { name: "口座を作る" }).click();
  const account = page.getByRole("dialog", { name: "口座を作る" });
  await account.getByLabel("名前").fill("現金");
  await account.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("口座を作りました")).toBeVisible();
  await page.getByRole("link", { name: "現金" }).click();
  await expect(page.getByRole("heading", { name: "現金", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "ホームへ" })).toHaveCount(0);
});
