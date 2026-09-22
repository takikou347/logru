import { expect, test } from "@playwright/test";
import { PASSWORD, logIn, signUp } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signUp(page);
  await page.goto("/settings");
});

test("明るさを選ぶと、すぐ変わり、読み込み直しても残る", async ({ page }) => {
  // 保存が届いたのを確かめてから読み込み直す。届く前に読み込み直すと、古い明るさが返ってくる
  const saved = page.waitForResponse((r) => r.url().endsWith("/api/me/settings") && r.request().method() === "PUT");
  await page.getByRole("radio", { name: "ダーク" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect((await saved).ok()).toBe(true);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("radio", { name: "ライト" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("明るさを選んですぐ読み込み直しても、選んだ明るさが残る", async ({ page }) => {
  // 通信が遅いときを作る。保存が届く前に読み込み直しても、保存を途中で切らせない
  await page.context().route("**/api/me/settings", async (route) => {
    await new Promise((r) => setTimeout(r, 1_500));
    await route.continue();
  });
  await page.getByRole("radio", { name: "ダーク" }).click();
  await page.reload();
  // 外すと、止めていた通信はその場で流れる。遅らせていた処理が後で route.continue を呼ぶと「もう済んでいる」で落ちるので、その誤りは捨てる
  await page.context().unrouteAll({ behavior: "ignoreErrors" });
  await expect(page.getByRole("radio", { name: "ダーク" })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
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
  await expect(page.getByRole("navigation", { name: "グループで絞る" }).getByRole("button", { name: "自分だけの予定" }).locator(".swatch-dot")).toHaveClass(
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
  const account = page.getByRole("region", { name: "アカウント" });
  await expect(account.getByText("テスト", { exact: true })).toBeVisible();
  await account.getByRole("button", { name: "表示名を変える" }).click();
  const input = account.getByLabel("表示名", { exact: true });
  await expect(input).toBeFocused();
  // 空の名前と、40 文字を超える名前は送らない
  await input.fill("");
  await input.press("Enter");
  await expect(account.getByText("表示名を入れてください。")).toBeVisible();
  await input.fill("あ".repeat(41));
  await account.getByRole("button", { name: "保存する" }).click();
  await expect(account.getByText("表示名は 40 文字までです。")).toBeVisible();
  await input.fill("こた");
  await input.press("Enter");
  await expect(page.getByText("表示名を変えました")).toBeVisible();
  await expect(account.getByLabel("表示名", { exact: true })).toHaveCount(0);
  await expect(account.getByText("こた", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "アカウント" }).getByText("こた", { exact: true })).toBeVisible();
});

test("表示名を直している途中で Esc を押すと、元の名前に戻る", async ({ page }) => {
  const account = page.getByRole("region", { name: "アカウント" });
  await account.getByRole("button", { name: "表示名を変える" }).click();
  await account.getByLabel("表示名", { exact: true }).fill("べつの名前");
  await account.getByLabel("表示名", { exact: true }).press("Escape");
  await expect(account.getByLabel("表示名", { exact: true })).toHaveCount(0);
  await expect(account.getByText("テスト", { exact: true })).toBeVisible();
  await expect(account.getByRole("button", { name: "表示名を変える" })).toBeFocused();
  // 開き直しても、途中の名前は残らない
  await account.getByRole("button", { name: "表示名を変える" }).click();
  await expect(account.getByLabel("表示名", { exact: true })).toHaveValue("テスト");
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
