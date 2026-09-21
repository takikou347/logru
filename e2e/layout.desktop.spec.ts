import { expect, test } from "@playwright/test";
import { dayPanel, openAccountMenu, signUp } from "./helpers";

let user: { email: string; name: string };

test.beforeEach(async ({ page }) => {
  user = await signUp(page);
});

test("PC では左にメニュー、右に選んだ日の予定を出し、下の操作は出さない", async ({ page }) => {
  await expect(page.getByRole("complementary", { name: "メニュー" })).toBeVisible();
  await expect(dayPanel(page)).toBeVisible();
  await expect(page.getByRole("toolbar", { name: "カレンダーの操作" })).toBeHidden();
});

test("左の列の下のアイコンから、設定を開き、ログアウトできる", async ({ page }) => {
  const aside = page.getByRole("complementary", { name: "メニュー" });
  await expect(aside.getByRole("link", { name: "設定" })).toHaveCount(0);
  let menu = await openAccountMenu(page);
  await expect(menu.getByText(user.email)).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "グループ" })).toHaveCount(0);
  await menu.getByRole("menuitem", { name: "設定" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("link", { name: "戻る" })).toBeHidden();

  menu = await openAccountMenu(page);
  await menu.getByRole("menuitem", { name: "ログアウト" }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("グループの詳しい画面では、PC でも左上の戻るボタンで一覧に戻れる", async ({ page }) => {
  await page.goto("/groups");
  await expect(page.getByRole("link", { name: "戻る" })).toBeHidden();
  await page.getByLabel("グループの名前").fill("ふたり");
  await page.getByRole("button", { name: "作る" }).click();
  await expect(page.getByRole("heading", { name: "ふたり" })).toBeVisible();
  await page.getByRole("link", { name: "戻る" }).click();
  await expect(page).toHaveURL(/\/groups$/);
});

test("N で予定を足すシートが開き、左右の矢印で月を移り、T で今日に戻る", async ({ page }) => {
  const month = page.getByTestId("month-number");
  const before = await month.textContent();
  await page.keyboard.press("ArrowRight");
  await expect(month).not.toHaveText(before!);
  await page.keyboard.press("t");
  await expect(month).toHaveText(before!);
  await page.keyboard.press("n");
  await expect(page.getByRole("dialog", { name: "新しい予定" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("PC ではマスに予定名が出て、押すと直すシートが開く", async ({ page }) => {
  await page.getByRole("button", { name: "予定を足す" }).first().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await sheet.getByLabel("題名").fill("打ち合わせ");
  await sheet.getByRole("button", { name: "保存する" }).click();
  const chip = page.getByRole("region", { name: "月の表" }).getByRole("button", { name: /打ち合わせ/ });
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(page.getByRole("dialog", { name: "予定を直す" })).toBeVisible();
});
