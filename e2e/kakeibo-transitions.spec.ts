import { expect, type Page, test } from "@playwright/test";
import { addExtension, signUp } from "./helpers";

/** 機能の一覧で、家計簿を自分だけで使えるようにする */
async function enableKakeibo(page: Page) {
  await addExtension(page, "家計簿");
}

/** 記録のシートを開く。家計簿の画面の下の帯から */
async function openRecordSheet(page: Page) {
  await page.goto("/kakeibo");
  await page.getByRole("toolbar", { name: "家計簿の操作" }).getByRole("button", { name: "支出を記録する" }).click();
  return page.getByRole("dialog", { name: "記録する" });
}

/** 記録を 1 件保存する */
async function saveExpense(page: Page, amount: string, memo: string) {
  const sheet = await openRecordSheet(page);
  await sheet.getByLabel("金額").fill(amount);
  await sheet.getByRole("radio", { name: "食費" }).click();
  await sheet.getByLabel("メモ").fill(memo);
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();
}

test("ホームを下までスクロールしてウィジェットから家計簿(合計)を開くと上から出て、戻ると元の位置に戻る。#201", async ({
  page,
}) => {
  await signUp(page, { name: "こた" });
  await enableKakeibo(page);

  await page.goto("/");
  await expect(page.getByTestId("widget-kakeibo-total")).toBeVisible();
  // ホームを下まで送る
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const homeScrollY = await page.evaluate(() => window.scrollY);
  expect(homeScrollY).toBeGreaterThan(0);

  // ウィジェットから移った家計簿の画面は、上から出る(残ったスクロール位置を持ち越さない)
  await page.getByTestId("widget-kakeibo-total").click();
  await expect(page).toHaveURL(/\/kakeibo$/);
  await expect(page.getByTestId("kakeibo-total")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  // 戻ると、ホームの元のスクロール位置に戻る
  await page.goBack();
  await expect(page).toHaveURL("/");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(homeScrollY);
});

test("ホームのウィジェットから開いた記録のシートは、やめても保存してもホームへ戻る。0070、#201", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableKakeibo(page);

  await page.goto("/");
  await page.getByTestId("widget-kakeibo-record").click();
  await expect(page).toHaveURL(/\/kakeibo\?record=1&from=widget/);
  const cancelDialog = page.getByRole("dialog", { name: "記録する" });
  await expect(cancelDialog).toBeVisible();
  await cancelDialog.getByRole("button", { name: "やめる" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByTestId("widget-kakeibo-record")).toBeVisible();

  await page.getByTestId("widget-kakeibo-record").click();
  const saveDialog = page.getByRole("dialog", { name: "記録する" });
  await saveDialog.getByLabel("金額").fill("800");
  await saveDialog.getByRole("radio", { name: "食費" }).click();
  await saveDialog.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();
  await expect(page).toHaveURL("/");
  await expect(page.getByTestId("widget-kakeibo-record")).toBeVisible();
});

test("家計簿の画面で「+」から開いた記録のシートは、閉じても家計簿の画面に残る。#201", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableKakeibo(page);

  const sheet = await openRecordSheet(page);
  await sheet.getByRole("button", { name: "やめる" }).click();
  await expect(page).toHaveURL(/\/kakeibo$/);
  await expect(page.getByTestId("kakeibo-total")).toBeVisible();
});

test("同じ日に 3 件記録すると、最後に保存したものが一番上に出る。#201", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableKakeibo(page);

  await saveExpense(page, "100", "1件目");
  await saveExpense(page, "200", "2件目");
  await saveExpense(page, "300", "3件目");

  const rows = page.getByRole("button", { name: /件目/ });
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("3件目");
  await expect(rows.nth(1)).toContainText("2件目");
  await expect(rows.nth(2)).toContainText("1件目");
});
