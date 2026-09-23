import { expect, type Page, test } from "@playwright/test";
import { logIn, logOut, signUp } from "./helpers";

// ほかのテストでは案内を止めている。ここでは止めずに、初めての人と同じにする。F-32
test.use({ storageState: { cookies: [], origins: [] } });

const guide = (page: Page) => page.getByRole("dialog");
const monthTable = (page: Page) => page.getByRole("region", { name: "月の表" });

/** Tab だけで、名前の合うボタンまでフォーカスを進める */
async function tabTo(page: Page, name: string) {
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    const text = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
    if (text === name) return;
  }
  throw new Error(`${name} にフォーカスが届かない`);
}

test("初めて入ると、同意のあとに案内が出て、キーボードだけで最後まで進める", async ({ page }) => {
  await signUp(page, { next: "/" });
  await expect(guide(page)).toBeVisible();
  await expect(guide(page).getByRole("heading", { name: "Logru へようこそ" })).toBeVisible();

  // 1 枚目は表示名の欄で Enter を押すと進む
  await guide(page).getByLabel("表示名").focus();
  await page.keyboard.press("Enter");
  await expect(guide(page).getByRole("heading", { name: "予定を足す" })).toBeVisible();

  await tabTo(page, "次へ");
  await page.keyboard.press("Enter");
  await expect(guide(page).getByRole("heading", { name: "グループで共有する" })).toBeVisible();

  await tabTo(page, "次へ");
  await page.keyboard.press("Enter");
  await expect(guide(page).getByRole("heading", { name: "機能を足す" })).toBeVisible();
  await expect(guide(page).getByText("ホーム画面に追加すると")).toBeVisible();

  const saved = page.waitForResponse((r) => r.url().endsWith("/api/me/onboarding") && r.request().method() === "PUT");
  await tabTo(page, "あとで");
  await page.keyboard.press("Enter");
  expect((await saved).ok()).toBe(true);
  await expect(guide(page)).toBeHidden();
  await expect(monthTable(page)).toBeVisible();

  await page.reload();
  await expect(monthTable(page)).toBeVisible();
  await expect(guide(page)).toBeHidden();
});

test("飛ばすと、読み込み直しても、入り直しても出ない。設定の使い方から開き直せる", async ({ page }) => {
  const { email } = await signUp(page, { next: "/" });
  await expect(guide(page)).toBeVisible();
  const saved = page.waitForResponse((r) => r.url().endsWith("/api/me/onboarding") && r.request().method() === "PUT");
  await guide(page).getByRole("button", { name: "飛ばす" }).click();
  expect((await saved).ok()).toBe(true);
  await expect(guide(page)).toBeHidden();

  await page.reload();
  await expect(monthTable(page)).toBeVisible();
  await expect(guide(page)).toBeHidden();

  // 別の端末で入ったのと同じ。見終えたかはサーバーに持つ
  await logOut(page);
  await logIn(page, email);
  await expect(monthTable(page)).toBeVisible();
  await expect(guide(page)).toBeHidden();

  await page.goto("/settings");
  const help = page.getByRole("region", { name: "使い方" });
  await help.getByRole("link", { name: "はじめての案内をもう一度見る" }).click();
  await expect(guide(page).getByRole("heading", { name: "Logru へようこそ" })).toBeVisible();
  await guide(page).getByRole("button", { name: "飛ばす" }).click();
  await expect(guide(page)).toBeHidden();
  await expect(page).not.toHaveURL(/onboarding=/);
});

test("案内の途中で予定を足すと、閉じたあとに続きの枚へ戻る", async ({ page }) => {
  await signUp(page, { next: "/" });
  await guide(page).getByRole("button", { name: "次へ" }).click();
  await guide(page).getByRole("button", { name: "予定を 1 つ足してみる" }).click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await sheet.getByLabel("題名").fill("はじめての予定");
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予定を足しました")).toBeVisible();
  await expect(guide(page).getByRole("heading", { name: "グループで共有する" })).toBeVisible();
});

test("よくある質問は、ログインしていなくても読める。#72", async ({ page }) => {
  await page.goto("/help");
  await expect(page.getByRole("heading", { name: "よくある質問", level: 1 })).toBeVisible();
  for (const q of [
    "予定をほかの人と共有するには",
    "グループに人を招くには",
    "機能を足すには",
    "知らせを受けるには",
    "退会するには",
  ]) {
    await expect(page.getByRole("heading", { name: q })).toBeVisible();
  }
  await expect(page).toHaveTitle(/よくある質問/);
});
