import { expect, test } from "@playwright/test";
import { addExtension, signUp } from "./helpers";

/**
 * PC(pointer: fine、hover できる)での SwipeRow(共通部品、0084、#225)。
 * スワイプではなく、行に乗せる・フォーカスすると小さなボタンが出る。
 */
test.use({ viewport: { width: 1280, height: 800 } });

test("行に乗せると「直す」「消す」の小さなボタンが出て、直すと入力に変わる", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await addExtension(page, "リスト");
  await page.goto("/lists");
  await page.getByRole("toolbar", { name: "リストの操作" }).getByRole("button", { name: "リストを作る" }).click();
  await page.getByRole("dialog", { name: "リストを作る" }).getByLabel("名前").fill("買い物");
  await page.getByRole("dialog", { name: "リストを作る" }).getByRole("button", { name: "作る" }).click();
  await expect(page).toHaveURL(/\/lists\/.+/);

  const addInput = page.getByLabel("項目を足す");
  await addInput.fill("にんじん");
  await addInput.press("Enter");
  await expect(page.getByText("にんじん")).toBeVisible();

  const row = page.locator("li", { hasText: "にんじん" });
  const editButton = row.getByRole("button", { name: "直す", exact: true });
  const deleteButton = row.getByRole("button", { name: "消す", exact: true });

  // 乗せる前は、透明で見えていない
  await expect(editButton).toHaveCSS("opacity", "0");
  await expect(deleteButton).toHaveCSS("opacity", "0");

  await row.hover();
  await expect(editButton).toHaveCSS("opacity", "1");
  await expect(deleteButton).toHaveCSS("opacity", "1");

  await editButton.click();
  const editInput = page.getByLabel("にんじん を直す");
  await expect(editInput).toBeFocused();
  await editInput.fill("大根");
  await editInput.press("Enter");
  await expect(page.getByText("大根")).toBeVisible();
  await expect(page.getByText("にんじん")).toHaveCount(0);
});

test("キーボードでフォーカスしても出る", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await addExtension(page, "リスト");
  await page.goto("/lists");
  await page.getByRole("toolbar", { name: "リストの操作" }).getByRole("button", { name: "リストを作る" }).click();
  await page.getByRole("dialog", { name: "リストを作る" }).getByLabel("名前").fill("買い物");
  await page.getByRole("dialog", { name: "リストを作る" }).getByRole("button", { name: "作る" }).click();
  await expect(page).toHaveURL(/\/lists\/.+/);

  const addInput = page.getByLabel("項目を足す");
  await addInput.fill("にんじん");
  await addInput.press("Enter");
  await expect(page.getByText("にんじん")).toBeVisible();

  const row = page.locator("li", { hasText: "にんじん" });
  const deleteButton = row.getByRole("button", { name: "消す", exact: true });
  await expect(deleteButton).toHaveCSS("opacity", "0");

  await deleteButton.focus();
  await expect(deleteButton).toHaveCSS("opacity", "1");
});
