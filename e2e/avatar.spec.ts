import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { addExtension, openAccountMenu, signUp } from "./helpers";

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

test("設定でアイコンを写真にすると、思い出の「その日」で記録を書いた人といいねを押した人も写真になる。#152", async ({
  page,
}) => {
  await signUp(page, { name: "こた" });

  await page.goto("/settings/appearance");
  await page.getByRole("region", { name: "アバター" }).locator('input[type="file"]').setInputFiles(PHOTO);
  await expect(page.getByText("アバターを写真にしました")).toBeVisible();

  await addExtension(page, "思い出");
  await page.goto("/memories?record=1");
  const sheet = page.getByRole("dialog", { name: "記録する" });
  await sheet.getByLabel("文章").fill("今日の記録");
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();

  // 最近の記録から、その日の画面を開く
  await page.goto("/memories");
  await page.getByRole("link", { name: /今日の記録/ }).click();
  await expect(page).toHaveURL(/\/memories\/on\//);

  // 記録に付いた写真は無いので、img は書いた人のアイコンだけ。頭文字の丸(span)ではない
  const article = page.getByRole("article", { name: "こた の記録" });
  await expect(article.locator("img")).toHaveCount(1);
  await expect(article.locator("img").first()).toHaveJSProperty("complete", true);

  // いいねを付けると、いいねを押した人(自分)のアイコンも写真で増える
  await article.getByRole("button", { name: /いいねを付ける/ }).click();
  await expect(article.getByRole("button", { name: /いいねを外す。いま 1/ })).toBeVisible();
  await expect(article.locator("img")).toHaveCount(2);
});
