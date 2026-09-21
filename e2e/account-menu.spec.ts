import { expect, test } from "@playwright/test";
import { openAccountMenu, signUp } from "./helpers";

test("スマホは上の帯のアイコンから、名前とメールアドレス、グループ、設定を開ける", async ({ page }) => {
  const { email, name } = await signUp(page, { name: "こた" });
  await expect(page.getByRole("button", { name: "メニューを開く" })).toHaveCount(0);

  let menu = await openAccountMenu(page);
  await expect(menu.getByText(name)).toBeVisible();
  await expect(menu.getByText(email)).toBeVisible();
  await menu.getByRole("menuitem", { name: "グループ" }).click();
  await expect(page).toHaveURL(/\/groups$/);

  // グループの一覧から戻るボタンでカレンダーへ戻り、今度は設定を開く
  await page.getByRole("link", { name: "戻る" }).click();
  menu = await openAccountMenu(page);
  await menu.getByRole("menuitem", { name: "設定" }).click();
  await expect(page).toHaveURL(/\/settings$/);
});
