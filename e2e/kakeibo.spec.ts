import { expect, type Page, test } from "@playwright/test";
import { addExtension, dayPanel, pickShare, signUp, tokyoDateParts } from "./helpers";

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

  // ウィジェットから開いたシートを閉じると、家計簿の画面には残らずホームへ戻る。0070、#201
  await expect(page).toHaveURL("/");
  // ホームの「今月の合計」に反映される
  await expect(total.getByText("¥1,200")).toBeVisible();

  // 家計簿の画面自身にも、この月の合計とカテゴリ別の内訳に反映される
  await page.goto("/kakeibo");
  await expect(page.getByTestId("kakeibo-total")).toHaveText("¥1,200");
  await expect(page.getByTestId("kakeibo-category-food")).toHaveText("食費");

  // カレンダーのその日に、小さく合計が出る
  await page.goto("/");
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

test("3 人のグループで 1 人が立て替えると、送る組み合わせが出て、精算すると 0 になる。共有口座の支出は精算に入らない。0072、F-318、F-319、F-320、F-321、F-322", async ({
  page,
  browser,
}) => {
  await signUp(page, { name: "こた" });
  await enableKakeibo(page);

  await page.goto("/groups");
  await page.getByLabel("グループの名前").fill("旅行");
  await page.getByRole("button", { name: "作る" }).click();
  await page.getByRole("button", { name: "招待リンクを作る" }).click();
  const inviteUrl = await page.getByLabel("招待リンク").inputValue();

  await page.goto("/settings/extensions/kakeibo");
  await page.getByRole("region", { name: "足すグループ" }).getByRole("button", { name: "旅行を足す" }).click();
  await expect(page.getByText("足しました")).toBeVisible();

  const mikaPage = await (await browser.newContext()).newPage();
  await signUp(mikaPage, { name: "みか", next: new URL(inviteUrl).pathname });
  await mikaPage.getByRole("button", { name: "参加する" }).click();
  await expect(mikaPage).toHaveURL(/group=/);
  await addExtension(mikaPage, "家計簿");

  const rikuPage = await (await browser.newContext()).newPage();
  await signUp(rikuPage, { name: "りく", next: new URL(inviteUrl).pathname });
  await rikuPage.getByRole("button", { name: "参加する" }).click();
  await expect(rikuPage).toHaveURL(/group=/);
  await addExtension(rikuPage, "家計簿");

  await createAccount(page, "現金", { openingBalance: "0" });
  await createAccount(page, "旅行の共有口座", { kind: "銀行", share: "旅行" });

  // 3 万円を、こたが現金(自分の口座)で立て替え、3 人で均等割り。既定の「全員で同じ額」のまま
  const expenseSheet = await openRecordSheet(page);
  await expenseSheet.getByLabel("金額").fill("30000");
  await expenseSheet.getByRole("radio", { name: "交通" }).click();
  await pickShare(page, expenseSheet, "旅行");
  await pickAccount(page, expenseSheet, "口座", "現金");
  await expect(expenseSheet.getByRole("button", { name: "払った人" })).toBeVisible();
  await expenseSheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();

  // 共有口座で払った支出。これは割らない(「払った人」の欄が出ない)
  const sharedExpenseSheet = await openRecordSheet(page);
  await sharedExpenseSheet.getByLabel("金額").fill("5000");
  await sharedExpenseSheet.getByRole("radio", { name: "食費" }).click();
  await pickShare(page, sharedExpenseSheet, "旅行");
  await pickAccount(page, sharedExpenseSheet, "口座", "旅行の共有口座");
  await expect(sharedExpenseSheet.getByRole("button", { name: "払った人" })).toHaveCount(0);
  await sharedExpenseSheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();

  // 精算の面に、みか・りくがそれぞれ 1 万円払う組み合わせが出る。共有口座の 5000 円は割った額に影響しない
  await page.goto("/kakeibo");
  await page.getByRole("button", { name: "旅行", exact: true }).click();
  const settlementPanel = page.getByRole("region", { name: "精算" });
  await expect(settlementPanel.getByText(/みか.*→.*自分.*¥10,000/)).toBeVisible();
  await expect(settlementPanel.getByText(/りく.*→.*自分.*¥10,000/)).toBeVisible();

  // みかの分から精算する
  const mikaRow = settlementPanel.locator("li", { hasText: "みか" });
  await mikaRow.getByRole("button", { name: "精算した" }).click();
  const settleSheet = page.getByRole("dialog", { name: "精算した" });
  await settleSheet.getByRole("radio", { name: "現金" }).click();
  await settleSheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("精算しました")).toBeVisible();
  // 送る組み合わせ(li)からは消える。精算した記録の一覧には残るので、そちらは数えない
  await expect(settlementPanel.locator("li").getByText(/みか.*→/)).toHaveCount(0);
  await expect(settlementPanel.locator("li").getByText(/りく.*→.*自分.*¥10,000/)).toBeVisible();

  // りくの分も精算すると、送る組み合わせが無くなる
  const rikuRow = settlementPanel.locator("li", { hasText: "りく" });
  await rikuRow.getByRole("button", { name: "精算した" }).click();
  const rikuSettleSheet = page.getByRole("dialog", { name: "精算した" });
  await rikuSettleSheet.getByRole("radio", { name: "現金" }).click();
  await rikuSettleSheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("精算しました")).toBeVisible();
  await expect(settlementPanel.getByText("精算はありません。")).toBeVisible();

  // 現金の残高は、立て替えた 3 万円が引かれ、精算で受け取った 2 万円が戻る
  await page.goto("/kakeibo/accounts");
  await expect(page.getByRole("link", { name: "現金" })).toContainText("-¥10,000");
});

test("期間の予算を作ると、家計簿の画面の上と予算の画面に、使った額と残りが出る。0072、F-323、F-324", async ({
  page,
}) => {
  await signUp(page, { name: "こた" });
  await enableKakeibo(page);

  const end = tokyoDateParts(30);

  await page.goto("/kakeibo/budgets");
  await page.getByRole("toolbar", { name: "予算の操作" }).getByRole("button", { name: "予算を作る" }).click();
  const sheet = page.getByRole("dialog", { name: "予算を作る" });
  await sheet.getByLabel("名前").fill("食費");
  await sheet.getByLabel("終わりの日").fill(end.key);
  await sheet.getByLabel("金額").fill("10000");
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予算を作りました")).toBeVisible();
  await expect(page.getByText("食費")).toBeVisible();
  await expect(page.getByText("残り ¥10,000")).toBeVisible();

  // 支出を記録すると、予算の使った額と残りに反映される
  const expense = await openRecordSheet(page);
  await expense.getByLabel("金額").fill("3000");
  await expense.getByRole("radio", { name: "食費" }).click();
  await expense.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();

  // 家計簿の画面の上にも、今日を含む予算として出る
  await page.goto("/kakeibo");
  const budgetPanel = page.getByRole("region", { name: "予算" });
  await expect(budgetPanel.getByText("食費")).toBeVisible();
  await expect(budgetPanel.getByText("使った額 ¥3,000")).toBeVisible();
  await expect(budgetPanel.getByText("残り ¥7,000")).toBeVisible();

  // 予算の画面でも同じ額を見られ、直す・消すができる
  await page.goto("/kakeibo/budgets");
  await expect(page.getByText("使った額 ¥3,000")).toBeVisible();
  await page.getByText("食費").click();
  const editSheet = page.getByRole("dialog", { name: "予算を直す" });
  await editSheet.getByLabel("金額").fill("20000");
  await editSheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予算を直しました")).toBeVisible();
  await expect(page.getByText("残り ¥17,000")).toBeVisible();

  await page.getByText("食費").click();
  await page.getByRole("dialog", { name: "予算を直す" }).getByRole("button", { name: "消す" }).click();
  await page.getByRole("button", { name: "本当に消す" }).click();
  await expect(page.getByText("予算を消しました")).toBeVisible();
  await expect(page.getByText("まだ予算がありません。")).toBeVisible();
});

test("決めた日をもう過ぎて定期の記録を作ると、すぐその月の分が入り、共有のグループでは作った人が払って割る。知らせに日付が出て元に戻せる。0072、F-325、#198", async ({
  page,
  browser,
}) => {
  await signUp(page, { name: "こた" });
  await enableKakeibo(page);

  await page.goto("/groups");
  await page.getByLabel("グループの名前").fill("暮らし");
  await page.getByRole("button", { name: "作る" }).click();
  await page.getByRole("button", { name: "招待リンクを作る" }).click();
  const inviteUrl = await page.getByLabel("招待リンク").inputValue();

  await page.goto("/settings/extensions/kakeibo");
  await page.getByRole("region", { name: "足すグループ" }).getByRole("button", { name: "暮らしを足す" }).click();
  await expect(page.getByText("足しました")).toBeVisible();

  const mikaPage = await (await browser.newContext()).newPage();
  await signUp(mikaPage, { name: "みか", next: new URL(inviteUrl).pathname });
  await mikaPage.getByRole("button", { name: "参加する" }).click();
  await expect(mikaPage).toHaveURL(/group=/);
  await addExtension(mikaPage, "家計簿");

  await createAccount(page, "現金", { openingBalance: "0" });

  // 毎月の日を 1 にすると、今日が何日でも必ずもう過ぎている。共有のグループで、自分の口座(共有口座でない)から払う
  await page.goto("/kakeibo/recurrings");
  await page
    .getByRole("toolbar", { name: "定期の記録の操作" })
    .getByRole("button", { name: "定期の記録を作る" })
    .click();
  const sheet = page.getByRole("dialog", { name: "定期の記録を作る" });
  await pickShare(page, sheet, "暮らし");
  // 全角の数字でも半角に直して入る。#198
  await sheet.getByLabel("金額").fill("１２０００");
  await sheet.getByRole("radio", { name: "住まい" }).click();
  await sheet.getByRole("radio", { name: "現金" }).click();
  await sheet.getByLabel("毎月の日").fill("1");
  await sheet.getByRole("button", { name: "保存する" }).click();
  // 知らせに、入れた記録の日付を出し、「元に戻す」でその 1 件だけを消せる。#198
  const today = tokyoDateParts(0);
  await expect(page.getByText(`${today.month}月1日の分を記録しました`)).toBeVisible();
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeVisible();

  // すぐその月の分が家計簿に入る。作った人(こた)が払い、みかと同じ額に割る
  await page.goto("/kakeibo");
  await page.getByRole("button", { name: "暮らし", exact: true }).click();
  await expect(page.getByTestId("kakeibo-total")).toHaveText("¥12,000");
  // 自分(こた)が払った側から見るので、「自分が払った」と自分の負担が出る
  await expect(page.getByText(/自分が払った.*自分の負担.*¥6,000/)).toBeVisible();

  // 現金の残高からすぐ引かれる
  await page.goto("/kakeibo/accounts");
  await expect(page.getByRole("link", { name: "現金" })).toContainText("-¥12,000");
});

test("共有のグループを抜けると、抜けた人がそのグループに作った定期の記録は止まる。#198", async ({ page, browser }) => {
  await signUp(page, { name: "こた" });
  await enableKakeibo(page);

  await page.goto("/groups");
  await page.getByLabel("グループの名前").fill("工房");
  await page.getByRole("button", { name: "作る" }).click();
  await page.getByRole("button", { name: "招待リンクを作る" }).click();
  const inviteUrl = await page.getByLabel("招待リンク").inputValue();
  const groupUrl = page.url();

  await page.goto("/settings/extensions/kakeibo");
  await page.getByRole("region", { name: "足すグループ" }).getByRole("button", { name: "工房を足す" }).click();
  await expect(page.getByText("足しました")).toBeVisible();

  const mikaPage = await (await browser.newContext()).newPage();
  await signUp(mikaPage, { name: "みか", next: new URL(inviteUrl).pathname });
  await mikaPage.getByRole("button", { name: "参加する" }).click();
  await expect(mikaPage).toHaveURL(/group=/);
  await addExtension(mikaPage, "家計簿");

  // みかが、工房グループに、来月から始まる定期の記録を作る。始まりの月がまだなので、すぐには入らない
  await mikaPage.goto("/kakeibo/recurrings");
  await mikaPage
    .getByRole("toolbar", { name: "定期の記録の操作" })
    .getByRole("button", { name: "定期の記録を作る" })
    .click();
  const sheet = mikaPage.getByRole("dialog", { name: "定期の記録を作る" });
  await pickShare(mikaPage, sheet, "工房");
  await sheet.getByLabel("金額").fill("3000");
  await sheet.getByRole("radio", { name: "住まい" }).click();
  const next = tokyoDateParts(31);
  await sheet.getByLabel("始まりの月").fill(`${next.year}-${String(next.month).padStart(2, "0")}`);
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(mikaPage.getByText("定期の記録を作りました")).toBeVisible();
  await expect(mikaPage.getByText("止めている")).toHaveCount(0);

  // みかが工房を抜けると、みかが作ったこの定期の記録は止まる。次の毎日の処理でも入らなくなる
  await mikaPage.goto(groupUrl);
  await mikaPage.getByRole("button", { name: "グループを抜ける" }).click();
  await mikaPage.getByRole("dialog", { name: "グループを抜けますか" }).getByRole("button", { name: "抜ける" }).click();

  await mikaPage.goto("/kakeibo/recurrings");
  await expect(mikaPage.getByText("止めている")).toBeVisible();
});

test("カテゴリを選ぶと、そのカテゴリで前回使った口座が選ばれる。口座を手で選べばそちらが残る。0072、F-327", async ({
  page,
}) => {
  await signUp(page, { name: "こた" });
  await enableKakeibo(page);

  await createAccount(page, "現金", { openingBalance: "0" });
  await createAccount(page, "銀行", { kind: "銀行" });

  // 日用品は銀行、食費は現金で覚えさせる。前回使った口座(直近は現金)と食費の記憶(銀行)をわざと違えて確かめる
  const first = await openRecordSheet(page);
  await first.getByLabel("金額").fill("1000");
  await first.getByRole("radio", { name: "食費" }).click();
  await pickAccount(page, first, "口座", "銀行");
  await first.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();

  const second = await openRecordSheet(page);
  await second.getByLabel("金額").fill("500");
  await second.getByRole("radio", { name: "日用品" }).click();
  await pickAccount(page, second, "口座", "現金");
  await second.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();

  // 新しく開くと、前回(日用品・現金)の口座が既定で選ばれている
  const third = await openRecordSheet(page);
  await expect(third.getByRole("button", { name: /^口座/ })).toContainText("現金");
  // 食費を選ぶと、前回使った口座(現金)ではなく、食費で覚えた銀行に変わる
  await third.getByRole("radio", { name: "食費" }).click();
  await expect(third.getByRole("button", { name: /^口座/ })).toContainText("銀行");

  // 口座を手で現金に選び直して保存すると、次から食費は現金が選ばれる
  await third.getByLabel("金額").fill("300");
  await pickAccount(page, third, "口座", "現金");
  await third.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();

  const fourth = await openRecordSheet(page);
  await fourth.getByRole("radio", { name: "食費" }).click();
  await expect(fourth.getByRole("button", { name: /^口座/ })).toContainText("現金");
});

test("記録のシートで「よく使う記録にする」と、次からチップで呼び出せる。F-326", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableKakeibo(page);
  await createAccount(page, "現金", { openingBalance: "0" });

  const sheet = await openRecordSheet(page);
  await sheet.getByLabel("金額").fill("500");
  await sheet.getByRole("radio", { name: "日用品" }).click();
  await pickAccount(page, sheet, "口座", "現金");
  await sheet.getByRole("button", { name: "よく使う記録にする" }).click();
  await sheet.getByLabel("よく使う記録の名前").fill("いつもの買い物");
  await sheet.getByRole("button", { name: "残す" }).click();
  await expect(page.getByText("よく使う記録にしました")).toBeVisible();
  await sheet.getByRole("button", { name: "やめる" }).click();

  // 次に開くと、チップに並び、押すと欄が埋まる
  const next = await openRecordSheet(page);
  await next.getByRole("button", { name: "いつもの買い物" }).click();
  await expect(next.getByLabel("金額")).toHaveValue("500");
  await expect(next.getByRole("radio", { name: "日用品", checked: true })).toBeVisible();
  await next.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();
  await expect(page.getByTestId("kakeibo-total")).toHaveText("¥500");

  // よく使う記録の画面にも出て、名前を直せる
  await page.goto("/kakeibo/templates");
  await page.getByText("いつもの買い物").click();
  await page.getByLabel("いつもの買い物 を直す").fill("スーパー");
  await page.getByLabel("いつもの買い物 を直す").press("Enter");
  await expect(page.getByText("スーパー")).toBeVisible();
});
