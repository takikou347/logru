import { expect, test } from "@playwright/test";
import { PASSWORD, latestOob, logIn, logOut, resetPassword, signUp, submitSignUp } from "./helpers";

test("ログインしていなければ、ログインの画面へ回す", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login\?next=%2Fsettings/);
  await expect(page.getByRole("button", { name: "ログイン", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Google でログイン" })).toBeVisible();
});

test("登録の画面に Google は無く、左上の戻るボタンでログインの画面に戻る", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("ログる")).toHaveCount(0);
  await page.getByRole("link", { name: "アカウントを作る" }).click();
  await expect(page.getByRole("heading", { name: "アカウントを作る" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Google/ })).toHaveCount(0);
  await expect(page.getByText("ログる")).toHaveCount(0);
  await page.getByRole("link", { name: "ログインの画面へ戻る" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("登録の画面の戻るボタンは、行き先を覚えたままログインの画面に戻る", async ({ page }) => {
  await page.goto("/signup?next=%2Fsettings");
  await page.getByRole("link", { name: "ログインの画面へ戻る" }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fsettings$/);
});

test("再設定の画面の左上の戻るボタンで、ログインの画面に戻る", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "パスワードを忘れた" }).click();
  await expect(page.getByRole("heading", { name: "パスワードを再設定する" })).toBeVisible();
  await page.getByRole("link", { name: "ログインの画面へ戻る" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("確かめる画面の左上の戻るボタンで、ログアウトしてログインの画面に戻る", async ({ page }) => {
  await submitSignUp(page);
  await expect(page.getByRole("heading", { name: "確認メールを送りました" })).toBeVisible();
  await page.getByRole("button", { name: "ログインの画面へ戻る" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "ログイン", exact: true })).toBeVisible();
});

test("規約に同意しないと登録できない", async ({ page }) => {
  await submitSignUp(page, { agree: false });
  await expect(page.getByRole("alert")).toHaveText("利用規約とプライバシーポリシーに同意してください。");
});

test("パスワードが短いと登録できない", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("表示名").fill("テスト");
  await page.getByLabel("メールアドレス", { exact: true }).fill("short@example.com");
  await page.getByLabel("パスワード", { exact: true }).fill("1234567");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("alert")).toHaveText("パスワードは 8 文字以上にしてください。");
});

test("登録し、確認メールを開くと、自分だけのグループでカレンダーが開く", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await expect(page).toHaveURL(/\/$|\/\?/);
  await expect(page.getByRole("navigation", { name: "グループで絞る" }).getByRole("button", { name: "自分" })).toBeVisible();
  // 登録の画面で同意したので、同意の画面は出ない
  await expect(page.getByRole("heading", { name: "規約への同意" })).toHaveCount(0);
});

test("確かめる前は、確かめる画面から先へ進めない", async ({ page }) => {
  const { email } = await submitSignUp(page);
  await expect(page.getByRole("heading", { name: "確認メールを送りました" })).toBeVisible();
  await page.goto("/");
  await expect(page).toHaveURL(/\/verify-email/);
  await page.getByRole("button", { name: "確かめた" }).click();
  await expect(page.getByText("まだ確かめられていません。")).toBeVisible();
  await page.getByRole("button", { name: "別のアカウントでログインする" }).click();
  await logIn(page, email);
  await expect(page).toHaveURL(/\/verify-email/);
});

test("ログアウトして、ログインし直せる", async ({ page }) => {
  const { email } = await signUp(page);
  await logOut(page);
  await logIn(page, email);
  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();
});

test("パスワードが違えば、どちらが違うかは言わずに断る", async ({ page }) => {
  const { email } = await signUp(page);
  await logOut(page);
  await logIn(page, email, "wrong-password");
  await expect(page.getByText("メールアドレスかパスワードが違います。")).toBeVisible();
});

test("パスワードを再設定して、新しいパスワードで入れる", async ({ page }) => {
  const { email } = await signUp(page);
  await logOut(page);
  await page.getByRole("link", { name: "パスワードを忘れた" }).click();
  // 画面が移り切る前に入れると、入れた値が消える。見出しが出てから入れる
  await expect(page.getByRole("heading", { name: "パスワードを再設定する" })).toBeVisible();
  await expect(async () => {
    await page.getByLabel("メールアドレス", { exact: true }).fill(email);
    await expect(page.getByLabel("メールアドレス", { exact: true })).toHaveValue(email, { timeout: 500 });
  }).toPass({ timeout: 10_000 });
  await page.getByRole("button", { name: "メールを送る" }).click();
  await expect(page.getByRole("heading", { name: "メールを送りました" })).toBeVisible();
  const { oobCode } = await latestOob(page.request, email, "PASSWORD_RESET");
  await resetPassword(page.request, oobCode, "new-password-99");
  await logIn(page, email, PASSWORD);
  await expect(page.getByText("メールアドレスかパスワードが違います。")).toBeVisible();
  await logIn(page, email, "new-password-99");
  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();
});

test("登録していないアドレスでも、再設定は同じ文を出す", async ({ page }) => {
  await page.goto("/reset-password");
  await page.getByLabel("メールアドレス", { exact: true }).fill("nobody@example.com");
  await page.getByRole("button", { name: "メールを送る" }).click();
  await expect(page.getByRole("heading", { name: "メールを送りました" })).toBeVisible();
});
