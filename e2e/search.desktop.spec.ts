import { expect, test } from "@playwright/test";
import { addEvent, signUp } from "./helpers";

test("PC は / のキーでも探すダイアログを開く。F-38", async ({ page }) => {
  await signUp(page);
  await addEvent(page, "歯医者の予約");

  // 別の入力欄にフォーカスがある間は奪わない
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const newSheet = page.getByRole("dialog", { name: "新しい予定" });
  await newSheet.getByLabel("題名").fill("");
  await newSheet.getByLabel("題名").focus();
  await page.keyboard.press("/");
  await expect(page.getByRole("dialog", { name: "探す" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(newSheet).toHaveCount(0);

  // 何も入力欄を触っていなければ、/ で開く
  await page.keyboard.press("/");
  const dialog = page.getByRole("dialog", { name: "探す" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("探す").fill("歯医者");
  await expect(dialog.getByRole("button", { name: /歯医者の予約/ })).toBeVisible();
});
