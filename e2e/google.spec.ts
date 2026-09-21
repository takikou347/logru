import { type Page, expect, test } from "@playwright/test";
import { logIn, logOut, signUp, submitSignUp, uniqueEmail } from "./helpers";

/**
 * Google でログインする。エミュレーターは Google の代わりに、アカウントを作る窓を出す。
 * @param button 押すボタンの名前
 */
async function googleSignIn(page: Page, email: string, name: string, button = "Google でログイン") {
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: button }).click();
  const popup = await popupPromise;
  // 窓の中の仕掛けが整う前に押すと、入力欄が開かない。開くまで押し直す
  await expect(async () => {
    await popup.locator("#add-account-button button").click();
    await expect(popup.locator("#email-input")).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await popup.locator("#email-input").fill(email);
  await popup.locator("#display-name-input").fill(name);
  await popup.locator("#sign-in").click();
  await popup.waitForEvent("close");
}

test("Google で初めて入ると、規約に同意してからカレンダーが開く", async ({ page }) => {
  await page.goto("/login");
  await googleSignIn(page, uniqueEmail("google"), "グーグル花子");
  await expect(page.getByRole("heading", { name: "規約への同意" })).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "同意して始める" }).click();
  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByRole("region", { name: "アカウント" }).getByText("グーグル花子", { exact: true })).toBeVisible();
  await expect(page.getByText("Google", { exact: true })).toBeVisible();
});

test("Google で入り直しても、同意は取り直さず、同じ人のまま", async ({ page }) => {
  const email = uniqueEmail("google");
  await page.goto("/login");
  await googleSignIn(page, email, "グーグル花子");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "同意して始める" }).click();
  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();

  await logOut(page);

  // 2 回目は、エミュレーターの一覧に出る同じアカウントを選ぶ
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Google でログイン" }).click();
  const popup = await popupPromise;
  await popup.getByText(email).click();
  await popup.waitForEvent("close");
  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();
});

test("メールで登録したのと同じアドレスで Google から入ると、同じアカウントに入る", async ({ page }) => {
  const email = uniqueEmail("both");
  await signUp(page, { name: "パスワード太郎", email });
  await logOut(page);

  await googleSignIn(page, email, "グーグル花子");
  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();
  // 表示名は D1 の値のまま。別の人として作り直していない
  await page.goto("/settings");
  await expect(page.getByRole("region", { name: "アカウント" }).getByText("パスワード太郎", { exact: true })).toBeVisible();
});

test("メールを確かめる前に同じアドレスで Google から入ると、パスワードでは入れなくなる", async ({ page }) => {
  const email = uniqueEmail("unverified");
  await submitSignUp(page, { email });
  await expect(page.getByRole("heading", { name: "確認メールを送りました" })).toBeVisible();
  await page.getByRole("button", { name: "別のアカウントでログインする" }).click();
  await expect(page).toHaveURL(/\/login/);

  // 確かめていないアドレスのパスワードは、他人が登録したものかもしれない。Google の側を残す
  // この端末で同じアドレスが登録の画面で同意しているので、同意の画面は出ない
  await googleSignIn(page, email, "グーグル花子");
  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();
  await logOut(page);
  await logIn(page, email);
  await expect(page.getByText("メールアドレスかパスワードが違います。")).toBeVisible();
});
