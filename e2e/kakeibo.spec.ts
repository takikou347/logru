import { expect, type Page, test } from "@playwright/test";
import { addExtension, dayPanel, signUp } from "./helpers";

/** 機能の一覧で、家計簿を自分だけで使えるようにする */
async function enableKakeibo(page: Page) {
  await addExtension(page, "家計簿");
}

test("足す前は、家計簿の画面は開けない", async ({ page }) => {
  await signUp(page);
  await page.goto("/kakeibo");
  await expect(page).toHaveURL(/\/settings\/extensions$/);
});

test("ホームの「記録する」から 3 タップと金額の入力 1 回で記録でき、今月の合計とカレンダーに出る。F-301、F-304、F-305、F-306", async ({
  page,
}) => {
  await signUp(page, { name: "こた" });
  await enableKakeibo(page);

  // 機能のシートに入口と「記録する」が出る
  await page.goto("/");
  await page.getByRole("toolbar", { name: "カレンダーの操作" }).getByRole("button", { name: "機能" }).click();
  const sheet = page.getByRole("dialog", { name: "機能" });
  await expect(sheet.getByRole("link", { name: /記録する/ })).toBeVisible();
  await expect(sheet.getByRole("link", { name: /家計簿/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  // ホームのウィジェットが最初から並ぶ
  const record = page.getByTestId("widget-kakeibo-record");
  const total = page.getByTestId("widget-kakeibo-total");
  await expect(record).toBeVisible();
  await expect(total).toBeVisible();

  // 1 タップ目: ホームの「記録する」からシートを開く
  await record.click();
  const dialog = page.getByRole("dialog", { name: "記録する" });
  await expect(dialog).toBeVisible();

  // 金額の入力 1 回
  await dialog.getByLabel("金額").fill("1200");
  // 2 タップ目: カテゴリを選ぶ。既定では何も選んでいないので保存できない
  await expect(dialog.getByRole("button", { name: "保存する" })).toBeDisabled();
  await dialog.getByRole("radio", { name: "食費" }).click();
  // 3 タップ目: 保存する。日付と共有先は既定のまま
  await dialog.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();

  // 家計簿の画面自身にも、この月の合計とカテゴリ別の内訳に反映される
  await expect(page.getByTestId("kakeibo-total")).toHaveText("¥1,200");
  await expect(page.getByTestId("kakeibo-category-food")).toHaveText("食費");

  // ホームの「今月の合計」に反映される
  await page.goto("/");
  await expect(total.getByText("¥1,200")).toBeVisible();

  // カレンダーのその日に、小さく合計が出る
  const badge = dayPanel(page).getByRole("button", { name: /¥1,200/ });
  await expect(badge).toBeVisible();

  // 押すと家計簿の画面へ移り、合計に出る
  await badge.click();
  await expect(page).toHaveURL(/\/kakeibo\?/);
  await expect(page.getByTestId("kakeibo-total")).toHaveText("¥1,200");
});

test("記録を直す、消すのは書いた人の家計簿の画面から。F-307", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableKakeibo(page);
  await page.goto("/kakeibo");

  await page.getByRole("button", { name: "記録する" }).click();
  const create = page.getByRole("dialog", { name: "記録する" });
  await create.getByLabel("金額").fill("500");
  await create.getByRole("radio", { name: "日用品" }).click();
  await create.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();
  await expect(page.getByTestId("kakeibo-total")).toHaveText("¥500");

  // 一覧の記録を押すと、直すシートが開く
  await page.getByRole("button", { name: /日用品/ }).click();
  const edit = page.getByRole("dialog", { name: "記録を直す" });
  await edit.getByLabel("金額").fill("800");
  await edit.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録を直しました")).toBeVisible();
  await expect(page.getByTestId("kakeibo-total")).toHaveText("¥800");

  await page.getByRole("button", { name: /日用品/ }).click();
  await page.getByRole("dialog", { name: "記録を直す" }).getByRole("button", { name: "消す" }).click();
  await expect(page.getByTestId("kakeibo-total")).toHaveText("¥0");
  await expect(page.getByText("この月の記録はまだありません。")).toBeVisible();
});
