import { expect, type Page, test } from "@playwright/test";
import { addExtension, dayPanel, pickShare, signUp } from "./helpers";

/** 機能の一覧で、家計簿を自分だけで使えるようにする */
async function enableKakeibo(page: Page) {
  await addExtension(page, "家計簿");
}

/**
 * 口座を作る。/kakeibo/accounts で「+」を押し、名前・種類・始まりの残高を入れて保存する。
 * @param kind 種類のチップの名前。省くと既定(現金)のまま
 */
async function createAccount(
  page: Page,
  name: string,
  opts: { kind?: string; openingBalance?: string; share?: string } = {},
) {
  await page.goto("/kakeibo/accounts");
  await page.getByRole("toolbar", { name: "口座の操作" }).getByRole("button", { name: "口座を作る" }).click();
  const sheet = page.getByRole("dialog", { name: "口座を作る" });
  await sheet.getByLabel("名前").fill(name);
  if (opts.kind) await sheet.getByRole("radio", { name: opts.kind }).click();
  if (opts.openingBalance !== undefined) {
    await sheet.getByLabel("始まりの残高").fill(opts.openingBalance);
  }
  if (opts.share) await pickShare(page, sheet, opts.share);
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("口座を作りました")).toBeVisible();
}

/** 記録のシートを開く。家計簿の画面の下の帯から */
async function openRecordSheet(page: Page) {
  await page.goto("/kakeibo");
  await page.getByRole("toolbar", { name: "家計簿の操作" }).getByRole("button", { name: "支出を記録する" }).click();
  return page.getByRole("dialog", { name: "記録する" });
}

/** 記録のシートで口座を選ぶ。「口座」「出す元」「入れる先」など、行の名前で選ぶ */
async function pickAccount(
  page: Page,
  sheet: import("@playwright/test").Locator,
  rowLabel: string,
  accountName: string,
) {
  await sheet.getByRole("button", { name: new RegExp(`^${rowLabel}`) }).click();
  await page.getByRole("dialog", { name: rowLabel }).getByRole("radio", { name: accountName }).click();
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

  // 機能のシートに入口が出る。記録の動線はホームのウィジェットへ移した
  await page.goto("/");
  await page.getByRole("toolbar", { name: "カレンダーの操作" }).getByRole("button", { name: "機能" }).click();
  const sheet = page.getByRole("dialog", { name: "機能" });
  await expect(sheet.getByRole("link", { name: /家計簿/ })).toBeVisible();
  await expect(sheet.getByRole("link", { name: /記録する/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  // ホームのウィジェットが最初から並ぶ
  const record = page.getByTestId("widget-kakeibo-record");
  const total = page.getByTestId("widget-kakeibo-total");
  await expect(record).toBeVisible();
  await expect(total).toBeVisible();

  // 1 タップ目: ホームの「記録する」からシートを開く。種類は既定で「支出」が選ばれている
  await record.click();
  const dialog = page.getByRole("dialog", { name: "記録する" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "支出" })).toHaveAttribute("aria-checked", "true");

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

  // 空の月は、下の帯の主なボタンと空の表示のボタンが同じ「支出を記録する」を名乗るので、帯の方を選ぶ
  const create = await openRecordSheet(page);
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

test("記録を消すと 5 秒だけ元に戻せる。issue #12", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableKakeibo(page);

  const create = await openRecordSheet(page);
  await create.getByLabel("金額").fill("500");
  await create.getByRole("radio", { name: "日用品" }).click();
  await create.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByTestId("kakeibo-total")).toHaveText("¥500");

  await page.getByRole("button", { name: /日用品/ }).click();
  await page.getByRole("dialog", { name: "記録を直す" }).getByRole("button", { name: "消す" }).click();
  await expect(page.getByTestId("kakeibo-total")).toHaveText("¥0");
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.getByTestId("kakeibo-total")).toHaveText("¥500");
});

test("続けて記録すると、金額とメモだけが空になり、シートは開いたまま。F-314", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableKakeibo(page);

  const sheet = await openRecordSheet(page);
  const amount = sheet.getByLabel("金額");
  await amount.fill("1000");
  await sheet.getByRole("radio", { name: "食費" }).click();
  await sheet.getByLabel("メモ").fill("スーパー");
  await sheet.getByRole("button", { name: "続けて記録" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();

  // シートは開いたまま、金額とメモだけが空になり、金額に入力が戻る
  await expect(sheet).toBeVisible();
  await expect(amount).toHaveValue("");
  await expect(amount).toBeFocused();
  await expect(sheet.getByLabel("メモ")).toHaveValue("");
  // カテゴリは選んだままなので、保存できる状態が続く
  await expect(sheet.getByRole("radio", { name: "食費", checked: true })).toBeVisible();

  await amount.fill("500");
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();
  await expect(page.getByTestId("kakeibo-total")).toHaveText("¥1,500");
});

test("口座を作り、支出・収入・振替を記録すると残高が合う。F-309、F-310、F-311、F-312", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableKakeibo(page);

  await createAccount(page, "現金", { openingBalance: "10000" });
  await createAccount(page, "りそな銀行", { kind: "銀行" });

  const expense = await openRecordSheet(page);
  await expense.getByLabel("金額").fill("3000");
  await expense.getByRole("radio", { name: "食費" }).click();
  await pickAccount(page, expense, "口座", "現金");
  await expense.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();

  const income = await openRecordSheet(page);
  await income.getByRole("radio", { name: "収入" }).click();
  await income.getByLabel("金額").fill("5000");
  await income.getByRole("radio", { name: "給料" }).click();
  await pickAccount(page, income, "口座", "りそな銀行");
  await income.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();

  const transfer = await openRecordSheet(page);
  await transfer.getByRole("radio", { name: "振替" }).click();
  await transfer.getByLabel("金額").fill("2000");
  await pickAccount(page, transfer, "出す元", "りそな銀行");
  await pickAccount(page, transfer, "入れる先", "現金");
  await transfer.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();

  await page.goto("/kakeibo/accounts");
  const cash = page.getByRole("link", { name: "現金" });
  const bank = page.getByRole("link", { name: "りそな銀行" });
  await expect(cash).toContainText("¥9,000");
  await expect(bank).toContainText("¥3,000");

  await page.goto("/kakeibo");
  await expect(page.getByTestId("kakeibo-assets")).toHaveText("¥12,000");
});

test("カードの残高はマイナスになり、引き落としの振替で戻る。F-309、F-311", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableKakeibo(page);

  await createAccount(page, "カード", { kind: "カード" });
  await createAccount(page, "銀行", { kind: "銀行", openingBalance: "10000" });

  const expense = await openRecordSheet(page);
  await expense.getByLabel("金額").fill("4000");
  await expense.getByRole("radio", { name: "食費" }).click();
  await pickAccount(page, expense, "口座", "カード");
  await expense.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();

  await page.goto("/kakeibo/accounts");
  await expect(page.getByRole("link", { name: "カード" })).toContainText("-¥4,000");

  const transfer = await openRecordSheet(page);
  await transfer.getByRole("radio", { name: "振替" }).click();
  await transfer.getByLabel("金額").fill("4000");
  await pickAccount(page, transfer, "出す元", "銀行");
  await pickAccount(page, transfer, "入れる先", "カード");
  await transfer.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();

  await page.goto("/kakeibo/accounts");
  await expect(page.getByRole("link", { name: "カード" })).toContainText("¥0");
  await expect(page.getByRole("link", { name: "銀行" })).toContainText("¥6,000");
});

test("共有口座への振替は共有のグループの人にも見えるが、出した元の自分の口座の名前は見えない。F-313", async ({
  page,
  browser,
}) => {
  await signUp(page, { name: "こた" });
  await enableKakeibo(page);

  await page.goto("/groups");
  await page.getByLabel("グループの名前").fill("ふたり");
  await page.getByRole("button", { name: "作る" }).click();
  await page.getByRole("button", { name: "招待リンクを作る" }).click();
  const inviteUrl = await page.getByLabel("招待リンク").inputValue();

  await page.goto("/settings/extensions/kakeibo");
  await page.getByRole("region", { name: "足すグループ" }).getByRole("button", { name: "ふたりを足す" }).click();
  await expect(page.getByText("足しました")).toBeVisible();

  const otherPage = await (await browser.newContext()).newPage();
  await signUp(otherPage, { name: "みか", next: new URL(inviteUrl).pathname });
  await otherPage.getByRole("button", { name: "参加する" }).click();
  await expect(otherPage).toHaveURL(/group=/);
  await addExtension(otherPage, "家計簿");

  await createAccount(page, "現金");
  await createAccount(page, "共有の財布", { kind: "銀行", share: "ふたり" });

  const transfer = await openRecordSheet(page);
  await transfer.getByRole("radio", { name: "振替" }).click();
  await transfer.getByLabel("金額").fill("5000");
  await pickAccount(page, transfer, "出す元", "現金");
  await pickAccount(page, transfer, "入れる先", "共有の財布");
  await transfer.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();

  // 共有のグループのメンバーには、金額と入った先(共有の財布)が見えるが、出した元は「こたさんの口座」とだけ出る
  await otherPage.goto("/kakeibo");
  await otherPage.getByRole("button", { name: "ふたり", exact: true }).click();
  await expect(otherPage.getByRole("button", { name: /こたさんの口座 → 共有の財布.*¥5,000/ })).toBeVisible();

  // 自分だけのグループの口座の名前と残高は、本人以外に返らない
  await otherPage.goto("/kakeibo/accounts");
  await expect(otherPage.getByText("現金")).toHaveCount(0);
  await expect(otherPage.getByRole("link", { name: "共有の財布" })).toBeVisible();
});
