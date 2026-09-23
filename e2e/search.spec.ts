import { expect, test } from "@playwright/test";
import { addEvent, signUp } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("探すと、その日を開き、押すと予定が開く。F-38", async ({ page }) => {
  await addEvent(page, "歯医者の予約");

  await page.getByRole("button", { name: "探す" }).click();
  const dialog = page.getByRole("dialog", { name: "探す" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("題名や場所を入れて探します。")).toBeVisible();

  await dialog.getByLabel("探す").fill("歯医者");
  const result = dialog.getByRole("button", { name: /歯医者の予約/ });
  await expect(result).toBeVisible();
  await result.click();

  await expect(dialog).toHaveCount(0);
  const editor = page.getByRole("dialog", { name: "予定を直す" });
  await expect(editor).toBeVisible();
  await expect(editor.getByLabel("題名")).toHaveValue("歯医者の予約");
});

test("見つからないときは、その旨が出る", async ({ page }) => {
  await addEvent(page, "歯医者の予約");
  await page.getByRole("button", { name: "探す" }).click();
  const dialog = page.getByRole("dialog", { name: "探す" });
  await dialog.getByLabel("探す").fill("存在しない予定の題名");
  await expect(dialog.getByText("見つかりませんでした。")).toBeVisible();
});
