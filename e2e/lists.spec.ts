import { expect, type Page, test } from "@playwright/test";
import { addExtension, dayPanel, signUp } from "./helpers";

/** 機能の一覧で、リストを自分だけで使えるようにする */
async function enableLists(page: Page) {
  await addExtension(page, "リスト");
}

test("足す前は、リストの画面は開けない", async ({ page }) => {
  await signUp(page);
  await page.goto("/lists");
  await expect(page).toHaveURL(/\/settings\/extensions$/);
});

test("リストを作り、項目を足す、チェックする、消す。日付を付けるとカレンダーに出る。F-201〜F-208", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableLists(page);

  // 機能のシートに入口と「リストに足す」が出る
  await page.goto("/");
  await page.getByRole("toolbar", { name: "カレンダーの操作" }).getByRole("button", { name: "機能" }).click();
  const sheet = page.getByRole("dialog", { name: "機能" });
  await expect(sheet.getByRole("link", { name: /リストに足す/ })).toBeVisible();
  await expect(sheet.getByTestId("extension-tile-lists")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  // ホームのウィジェットが最初から並び、リストが無い間は作るよう促す
  const widget = page.getByTestId("widget-lists-latest");
  await expect(widget).toBeVisible();
  await expect(widget.getByText("作ってみましょう")).toBeVisible();

  // リストを作る
  await page.goto("/lists");
  await expect(page.getByText("リストを作ると、ここに並びます。")).toBeVisible();
  // 空の一覧は、下の帯の主なボタンと空の表示のボタンが同じ「リストを作る」を名乗るので、帯の方を選ぶ
  await page.getByRole("toolbar", { name: "リストの操作" }).getByRole("button", { name: "リストを作る" }).click();
  const create = page.getByRole("dialog", { name: "リストを作る" });
  await create.getByLabel("名前").fill("買い物");
  await create.getByLabel("日付").fill("2026-09-25");
  await create.getByRole("button", { name: "作る" }).click();
  await expect(page).toHaveURL(/\/lists\/.+/);

  // 1 行打って Enter で次の項目へ。入力欄はそのまま続けて打てる。F-203
  const addInput = page.getByLabel("項目を足す");
  await addInput.fill("にんじん");
  await addInput.press("Enter");
  await expect(page.getByText("にんじん")).toBeVisible();
  await expect(addInput).toHaveValue("");
  await addInput.fill("たまねぎ");
  await addInput.press("Enter");
  await expect(page.getByText("たまねぎ")).toBeVisible();

  // チェックすると、字が薄く、一覧の下へ寄る。F-204
  const carrot = page.getByRole("checkbox", { name: "にんじん をチェックする" });
  await carrot.click();
  await expect(carrot).toBeChecked();
  const rows = page.locator("li", { has: page.getByRole("checkbox") });
  await expect(rows.last()).toContainText("にんじん");

  // 消せる。5 秒だけ元に戻せるので、実際に消えるまで待つ。F-205、issue #12
  await page.getByRole("button", { name: "たまねぎ を消す" }).click();
  await expect(page.getByText("たまねぎ")).toBeHidden();
  await page.waitForTimeout(6_000);

  // ホームの「リスト」のウィジェットに反映される
  await page.goto("/");
  await expect(widget.getByText("買い物")).toBeVisible();
  await expect(widget.getByText("残り 0")).toBeVisible();

  // 日付を付けたので、カレンダーのその日に出る。押すとリストの画面へ移る
  await page.goto("/?date=2026-09-25");
  const badge = dayPanel(page).getByRole("button", { name: /買い物/ });
  await expect(badge).toBeVisible();
  await badge.click();
  await expect(page).toHaveURL(/\/lists\/.+/);
  await expect(page.getByRole("heading", { name: "買い物" })).toBeVisible();
});

test("項目を消すと 5 秒だけ元に戻せる。issue #12", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableLists(page);
  await page.goto("/lists");
  await page.getByRole("toolbar", { name: "リストの操作" }).getByRole("button", { name: "リストを作る" }).click();
  const create = page.getByRole("dialog", { name: "リストを作る" });
  await create.getByLabel("名前").fill("買い物");
  await create.getByRole("button", { name: "作る" }).click();
  await expect(page).toHaveURL(/\/lists\/.+/);

  const addInput = page.getByLabel("項目を足す");
  await addInput.fill("にんじん");
  await addInput.press("Enter");
  await expect(page.getByText("にんじん")).toBeVisible();

  await page.getByRole("button", { name: "にんじん を消す" }).click();
  await expect(page.getByText("にんじん")).toBeHidden();
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.getByText("にんじん")).toBeVisible();
});

test("リストを直す、消す。グループの誰でもできる。「リストに足す」の近道はいちばん新しいリストを開く", async ({
  page,
}) => {
  await signUp(page, { name: "こた" });
  await enableLists(page);
  await page.goto("/lists");
  await page.getByRole("toolbar", { name: "リストの操作" }).getByRole("button", { name: "リストを作る" }).click();
  await page.getByRole("dialog", { name: "リストを作る" }).getByLabel("名前").fill("旅行の持ち物");
  await page.getByRole("dialog", { name: "リストを作る" }).getByRole("button", { name: "作る" }).click();
  await expect(page).toHaveURL(/\/lists\/.+/);

  // 名前を直す
  await page.getByRole("button", { name: "リストを直す" }).click();
  const edit = page.getByRole("dialog", { name: "リストを直す" });
  await edit.getByLabel("名前").fill("旅行のかばん");
  await edit.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("リストを直しました")).toBeVisible();
  await expect(page.getByRole("heading", { name: "旅行のかばん" })).toBeVisible();

  // 消す前に確かめる
  await page.getByRole("button", { name: "リストを直す" }).click();
  await page.getByRole("dialog", { name: "リストを直す" }).getByRole("button", { name: "消す" }).click();
  const confirm = page.getByRole("dialog", { name: "リストを消しますか" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "消す" }).click();
  await expect(page).toHaveURL(/\/lists$/);
  await expect(page.getByText("リストを作ると、ここに並びます。")).toBeVisible();

  // リストが無いときの近道は、作るシートが開いた一覧へ移る
  await page.goto("/lists/latest");
  await expect(page.getByRole("dialog", { name: "リストを作る" })).toBeVisible();
});
