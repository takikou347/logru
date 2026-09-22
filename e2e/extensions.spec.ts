import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("下の操作の「機能」で機能のシートが開き、機能の一覧へ移れる", async ({ page }) => {
  await signUp(page);
  await page.getByRole("toolbar", { name: "カレンダーの操作" }).getByRole("button", { name: "機能" }).click();
  const sheet = page.getByRole("dialog", { name: "機能" });
  await expect(sheet.getByRole("link", { name: /グループ/ })).toBeVisible();
  await sheet.getByRole("link", { name: "機能を足す、外す" }).click();
  await expect(page).toHaveURL(/\/extensions$/);
  await expect(page.getByRole("heading", { name: "機能" })).toBeVisible();
});

test("「予定を足す」は予定のシートだけを開く", async ({ page }) => {
  await signUp(page);
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  await expect(page.getByRole("dialog", { name: "新しい予定" })).toBeVisible();
});

test("グループが多くても、グループの絞り込みは横に流れて全部押せる", async ({ page }) => {
  await signUp(page);
  for (const name of ["ふたり", "実家", "大学の友人", "職場の同期", "フットサル", "町内会"]) {
    await page.goto("/groups");
    await page.getByLabel("グループの名前").fill(name);
    await page.getByRole("button", { name: "作る" }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "グループで絞る" });
  const last = nav.getByRole("button", { name: "町内会" });
  await last.scrollIntoViewIfNeeded();
  await last.click();
  await expect(last).toHaveAttribute("aria-pressed", "true");
});
