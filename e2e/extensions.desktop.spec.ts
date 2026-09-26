import { expect, test } from "@playwright/test";
import { addExtension, signUp } from "./helpers";

test("PC の左の列に入口が並び、グループが多いときは絞り込みの欄だけが流れる", async ({ page }) => {
  await signUp(page);
  for (let i = 1; i <= 14; i++) {
    await page.goto("/groups");
    await page.getByLabel("グループの名前").fill(`グループ${i}`);
    await page.getByRole("button", { name: "作る" }).click();
    await expect(page.getByRole("heading", { name: `グループ${i}` })).toBeVisible();
  }
  await page.goto("/");
  const menu = page.getByRole("complementary", { name: "メニュー" });
  await expect(menu.getByRole("link", { name: "機能を足す、外す" })).toBeVisible();
  // アカウントは下に残り、押せる
  await expect(menu.getByRole("button", { name: "アカウントのメニュー" })).toBeInViewport();
  // グループの欄は流れる
  const list = menu.getByRole("group", { name: "表示するグループ" });
  const last = list.getByRole("button", { name: "グループ9", exact: true });
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
});

test("足せる機能が無ければ、PC の左の列は「機能を外す」になる。issue #224", async ({ page }) => {
  await signUp(page);
  for (const label of ["思い出", "家計簿", "リスト"]) {
    await addExtension(page, label);
  }
  await page.goto("/");
  const menu = page.getByRole("complementary", { name: "メニュー" });
  await expect(menu.getByRole("link", { name: "機能を外す" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "機能を足す、外す" })).toHaveCount(0);
});
