import { expect, test } from "@playwright/test";
import { PASSWORD, latestMailLink, logIn, signUp, uniqueEmail } from "./helpers";

test("ログインしていなければ、ログインの画面へ回す", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login\?next=%2Fsettings/);
  await expect(page.getByRole("button", { name: "ログイン", exact: true })).toBeVisible();
});

test("規約に同意しないと登録できない", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("表示名").fill("テスト");
  await page.getByLabel("メールアドレス").fill(uniqueEmail());
  await page.getByLabel("パスワード").fill(PASSWORD);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("alert")).toHaveText("利用規約とプライバシーポリシーに同意してください。");
});

test("規約への同意はサーバーでも確かめる", async ({ request }) => {
  const res = await request.post("/api/auth/sign-up/email", {
    data: { name: "テスト", email: uniqueEmail(), password: PASSWORD },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).code).toBe("LEGAL_NOT_AGREED");
});

test("登録し、確認メールを開くと、自分だけのグループでカレンダーが開く", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await expect(page).toHaveURL(/\/$|\/\?/);
  await expect(page.getByRole("navigation", { name: "グループで絞る" }).getByRole("button", { name: "自分" })).toBeVisible();
  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();
});

test("確かめる前はログインできない", async ({ page }) => {
  const email = uniqueEmail();
  await page.goto("/signup");
  await page.getByLabel("表示名").fill("テスト");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: "確認メールを送りました" })).toBeVisible();
  await logIn(page, email);
  await expect(page.getByText("メールアドレスがまだ確かめられていません。")).toBeVisible();
});

test("ログアウトして、ログインし直せる", async ({ page }) => {
  const { email } = await signUp(page);
  await page.getByRole("button", { name: "メニューを開く" }).click();
  await page.getByRole("dialog", { name: "メニュー" }).getByRole("button", { name: "ログアウト" }).click();
  await expect(page).toHaveURL(/\/login/);
  await logIn(page, email);
  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();
});

test("5 回続けて間違えると 15 分止める", async ({ page }) => {
  const { email } = await signUp(page);
  await page.context().clearCookies();
  for (let i = 4; i >= 1; i--) {
    await logIn(page, email, "wrong-password");
    await expect(page.getByText(`あと ${i} 回違うと 15 分ログインできません。`)).toBeVisible();
  }
  await logIn(page, email, "wrong-password");
  await expect(page.getByText(/続けて間違えたため、ログインを止めています。/)).toBeVisible();
  // 正しいパスワードでも、止めている間は入れない
  await logIn(page, email);
  await expect(page.getByText(/ログインを止めています/)).toBeVisible();
});

test("パスワードを再設定して、新しいパスワードで入れる", async ({ page }) => {
  const { email } = await signUp(page);
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByRole("link", { name: "パスワードを忘れた" }).click();
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByRole("button", { name: "メールを送る" }).click();
  await expect(page.getByRole("heading", { name: "メールを送りました" })).toBeVisible();
  const link = await latestMailLink(page.request, email, /再設定/);
  await page.goto(link);
  await page.getByLabel("新しいパスワード").fill("new-password-99");
  await page.getByRole("button", { name: "パスワードを変える" }).click();
  await expect(page.getByRole("heading", { name: "パスワードを変えました" })).toBeVisible();
  await logIn(page, email, PASSWORD);
  await expect(page.getByText(/メールアドレスかパスワードが違います/)).toBeVisible();
  await logIn(page, email, "new-password-99");
  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();
});

test("ほかの出どころからの書き込みは断る", async ({ page }) => {
  await signUp(page);
  const res = await page.request.post("/api/groups", {
    data: { name: "x" },
    headers: { Origin: "https://evil.example" },
  });
  expect(res.status()).toBe(403);
});
