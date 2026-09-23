import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { openAccountMenu, signUp } from "./helpers";

// 写真は Unsplash License のフリー写真を小さくしたもの。出どころは develop-docs の docs/logru/extensions/memories/images/photos/sources.txt
const PHOTO = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/photo.jpg");

test("設定で写真を置くとメニューのアバターが写真になり、頭文字に戻すと元に戻る", async ({ page }) => {
  await signUp(page, { name: "こた" });

  // 置く前は、カレンダーのメニューのアイコンは頭文字。写真の img は無い
  let menu = await openAccountMenu(page);
  await expect(menu.locator("img")).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.goto("/settings/appearance");
  const avatarPanel = page.getByRole("region", { name: "アバター" });
  await expect(avatarPanel.getByRole("button", { name: "頭文字に戻す" })).toBeDisabled();

  await avatarPanel.locator('input[type="file"]').setInputFiles(PHOTO);
  await expect(page.getByText("アバターを写真にしました")).toBeVisible();
  await expect(avatarPanel.getByRole("button", { name: "頭文字に戻す" })).toBeEnabled();
  await expect(avatarPanel.locator("img")).toHaveJSProperty("complete", true);

  // 読み込み直しても写真のまま
  await page.reload();
  await expect(page.getByRole("region", { name: "アバター" }).locator("img")).toHaveJSProperty("complete", true);

  // カレンダーのメニューにも同じ写真が出る
  await page.goto("/");
  menu = await openAccountMenu(page);
  await expect(menu.locator("img")).toHaveCount(1);
  await page.keyboard.press("Escape");

  // 頭文字に戻すと、メニューも頭文字に戻る
  await page.goto("/settings/appearance");
  await page.getByRole("region", { name: "アバター" }).getByRole("button", { name: "頭文字に戻す" }).click();
  await expect(page.getByText("アバターを頭文字に戻しました")).toBeVisible();
  await expect(page.getByRole("region", { name: "アバター" }).locator("img")).toHaveCount(0);
  await page.goto("/");
  menu = await openAccountMenu(page);
  await expect(menu.locator("img")).toHaveCount(0);
});
