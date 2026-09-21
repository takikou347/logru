import { expect, test } from "@playwright/test";
import { PASSWORD, logIn, signUp } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signUp(page);
  await page.goto("/settings");
});

test("明るさを選ぶと、すぐ変わり、読み込み直しても残る", async ({ page }) => {
  await page.getByRole("radio", { name: "ダーク" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("radio", { name: "ライト" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("端末と同じが既定で、端末の明るさに合わせる", async ({ page }) => {
  await expect(page.getByRole("radio", { name: "端末と同じ" })).toHaveAttribute("aria-checked", "true");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("テーマカラーと自分の色を選べる", async ({ page }) => {
  await page.getByRole("radiogroup", { name: "テーマカラー" }).getByRole("radio", { name: "紺" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-accent", "kon");
  await page.getByRole("radiogroup", { name: "自分の色" }).getByRole("radio", { name: "藤" }).click();
  await page.reload();
  await expect(page.getByRole("radiogroup", { name: "自分の色" }).getByRole("radio", { name: "藤" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "グループで絞る" }).getByRole("button", { name: "自分" }).locator(".swatch-dot")).toHaveClass(
    /c-fuji/,
  );
});

test("グループの色を、自分の画面の中だけで変え、元に戻せる", async ({ page }) => {
  await page.goto("/groups");
  await page.getByLabel("グループの名前").fill("ふたり");
  await page.getByRole("button", { name: "作る" }).click();
  await page.goto("/settings");
  await page.getByRole("button", { name: /ふたり/ }).click();
  const sheet = page.getByRole("dialog", { name: "ふたり の色" });
  await sheet.getByRole("radio", { name: "柿" }).click();
  await sheet.getByRole("button", { name: "閉じる" }).click();
  await expect(page.getByRole("button", { name: /ふたり.*自分だけ変えた/ })).toBeVisible();
  await page.getByRole("button", { name: /ふたり/ }).click();
  await page.getByRole("dialog", { name: "ふたり の色" }).getByRole("button", { name: "元の色に戻す" }).click();
  await page.getByRole("dialog", { name: "ふたり の色" }).getByRole("button", { name: "閉じる" }).click();
  await expect(page.getByRole("button", { name: /ふたり.*グループの色のまま/ })).toBeVisible();
});

test("表示名を変えられる", async ({ page }) => {
  await page.getByRole("button", { name: /を変える/ }).click();
  const sheet = page.getByRole("dialog", { name: "表示名を変える" });
  await sheet.getByLabel("表示名").fill("こた");
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByRole("button", { name: "こた を変える" })).toBeVisible();
});

test("アカウントを消すと、ログインできなくなる", async ({ page }) => {
  const email = await page.getByRole("region", { name: "アカウント" }).getByText(/@example\.com/).textContent();
  await page.getByRole("button", { name: "アカウントを消す" }).click();
  const sheet = page.getByRole("dialog", { name: "アカウントを消す" });
  await expect(sheet.getByRole("button", { name: "アカウントを消す" })).toBeDisabled();
  await sheet.getByLabel(/削除する/).fill("削除する");
  await sheet.getByLabel("パスワード", { exact: true }).fill("wrong-password");
  await sheet.getByRole("button", { name: "アカウントを消す" }).click();
  await expect(sheet.getByText("メールアドレスかパスワードが違います。")).toBeVisible();
  await sheet.getByLabel("パスワード", { exact: true }).fill(PASSWORD);
  await sheet.getByRole("button", { name: "アカウントを消す" }).click();
  await expect(page.getByText("アカウントを消しました")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  await logIn(page, email!);
  await expect(page.getByText("メールアドレスかパスワードが違います。")).toBeVisible();
});
