import { expect, test } from "@playwright/test";
import { addExtension, signUp } from "./helpers";

/**
 * 「‹」は、決まった画面ではなく前に表示していた画面へ戻る。0070
 * 記録が無い(URL を直に開いたなど)ときだけ、決まった先へ移る。
 */

test("カレンダー→家計簿→口座の画面まで進み、「‹」を 2 回押すとカレンダーに戻る", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await addExtension(page, "家計簿");

  await page.goto("/");
  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();

  // アプリの中の道だけで、家計簿 → 口座 とすすめる
  await page.getByRole("toolbar", { name: "カレンダーの操作" }).getByRole("button", { name: "機能" }).click();
  await page.getByRole("dialog", { name: "機能" }).getByTestId("extension-tile-kakeibo").click();
  await expect(page).toHaveURL(/\/kakeibo$/);
  await expect(page.getByRole("heading", { name: "家計簿", level: 1 })).toBeVisible();

  await page.getByRole("link", { name: "口座を作る" }).click();
  await expect(page).toHaveURL(/\/kakeibo\/accounts$/);
  await expect(page.getByRole("heading", { name: "家計簿の口座", level: 1 })).toBeVisible();

  // 1 回目の「‹」: 家計簿へ
  await page.getByRole("link", { name: "戻る" }).click();
  await expect(page).toHaveURL(/\/kakeibo$/);
  await expect(page.getByRole("heading", { name: "家計簿", level: 1 })).toBeVisible();

  // 2 回目の「‹」: カレンダーへ
  await page.getByRole("link", { name: "戻る" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();
});

test("設定→機能→機能の詳細まで進み、「‹」はひとつ前の画面へ戻る", async ({ page }) => {
  await signUp(page);

  await page.goto("/settings");
  await page.getByRole("link", { name: "機能" }).click();
  await expect(page).toHaveURL(/\/settings\/extensions$/);

  // 「外部のカレンダー」は自分の画面(nav)を持たないので、タイルを押すと機能の詳細が開く
  await page.getByTestId("extension-tile-external").click();
  await expect(page).toHaveURL(/\/settings\/extensions\/external$/);
  await expect(page.getByRole("heading", { name: "外部のカレンダー", level: 1 })).toBeVisible();

  await page.getByRole("link", { name: "戻る" }).click();
  await expect(page).toHaveURL(/\/settings\/extensions$/);
});

test("URL を直に開いたときは、前の画面の記録が無いので決まった先へ戻る", async ({ page }) => {
  await signUp(page);

  // アプリの中を経由せず、直に URL を開く
  await page.goto("/settings/extensions/external");
  await expect(page.getByRole("heading", { name: "外部のカレンダー", level: 1 })).toBeVisible();

  await page.getByRole("link", { name: "戻る" }).click();
  await expect(page).toHaveURL(/\/settings\/extensions$/);
});
