import { expect, type Page, test } from "@playwright/test";
import { addExtension, dayPanel, signUp } from "./helpers";

/** 機能の一覧で、リストを自分だけで使えるようにする */
async function enableLists(page: Page) {
  await addExtension(page, "リスト");
}

/**
 * 指定した時刻の、日本時間での日付を `yyyy-mm-dd` の形で返す。
 * `page.clock` で時刻を固定したテストでは、`Date.now()` を使う `tokyoDateParts` ではなく、
 * 固定した時刻そのものから計算する
 */
function jstDateKeyAt(at: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

test("足す前は、リストの画面は開けない", async ({ page }) => {
  await signUp(page);
  await page.goto("/lists");
  await expect(page).toHaveURL(/\/settings\/extensions$/);
});

test("リストを作り、項目を足す、チェックする、消す。日付を付けるとカレンダーに出る。F-201〜F-208", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableLists(page);

  // 機能のシートには入口のタイルだけが出る。記録の動線はホームのウィジェットへ移した
  await page.goto("/");
  await page.getByRole("toolbar", { name: "カレンダーの操作" }).getByRole("button", { name: "機能" }).click();
  const sheet = page.getByRole("dialog", { name: "機能" });
  await expect(sheet.getByTestId("extension-tile-lists")).toBeVisible();
  await expect(sheet.getByRole("link", { name: /リストに足す/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  // ホームの「リスト」ウィジェットが最初から並び、リストが無い間は作るよう促す
  const widget = page.getByTestId("widget-lists-latest");
  await expect(widget).toBeVisible();
  await expect(widget.getByText("作ってみましょう")).toBeVisible();

  // 「リストに足す」のウィジェットは既定では並ばない。ホームを編集して足せる
  await expect(page.getByTestId("widget-lists-add")).toHaveCount(0);
  await page.getByRole("button", { name: "ホームを編集" }).click();
  await page.getByRole("button", { name: "ウィジェットを足す" }).click();
  await page
    .getByRole("dialog", { name: "ウィジェットを足す" })
    .getByRole("button", { name: /リストに足す/ })
    .click();
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("ホームを保存しました")).toBeVisible();
  await expect(page.getByTestId("widget-lists-add")).toBeVisible();

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

  // 日付の書き方は `M月D日` の 1 つだけ。曜日は付けない。決定 0059
  await expect(page.getByText("9月25日 のカレンダーに出ています")).toBeVisible();

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

/**
 * iPhone の Safari は、日付・時刻の入力欄のネイティブな選択 UI を閉じるとき、シートの外側で
 * 起きたように見えるポインター・クリックの動きを送ることがある。Playwright では実機の動きを
 * 直に再現できないため、同じ形のイベントを `document.body` へ送って再現する
 */
async function dispatchOutsidePointerAndClick(page: Page) {
  await page.evaluate(() => {
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 }));
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  });
}

test("日付の入力にフォーカスが残ったまま外側でポインターの動きが起きても、リストを作るシートは閉じずに登録できる", async ({
  page,
}) => {
  await signUp(page, { name: "こた" });
  await enableLists(page);
  await page.goto("/lists");
  await page.getByRole("toolbar", { name: "リストの操作" }).getByRole("button", { name: "リストを作る" }).click();
  const create = page.getByRole("dialog", { name: "リストを作る" });
  await create.getByLabel("名前").fill("買い物");
  const dateInput = create.getByLabel("日付");
  await dateInput.click();
  await dateInput.fill("2026-09-25");
  await expect(dateInput).toBeFocused();

  // 日付の入力欄にまだフォーカスが残っている間は、外側の動きが起きてもシートを閉じない
  await dispatchOutsidePointerAndClick(page);
  await expect(create).toBeVisible();
  await expect(create.getByLabel("日付")).toHaveValue("2026-09-25");

  await create.getByRole("button", { name: "作る" }).click();
  await expect(page).toHaveURL(/\/lists\/.+/);
});

test("日付の入力からフォーカスを外した後は、外側の動きでシートが今までどおり閉じる", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableLists(page);
  await page.goto("/lists");
  await page.getByRole("toolbar", { name: "リストの操作" }).getByRole("button", { name: "リストを作る" }).click();
  const create = page.getByRole("dialog", { name: "リストを作る" });
  const dateInput = create.getByLabel("日付");
  await dateInput.click();
  await dateInput.fill("2026-09-25");
  await create.getByLabel("名前").focus();

  await dispatchOutsidePointerAndClick(page);
  await expect(create).toBeHidden();
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

test("項目の文字を押すと直せる。Enter で保存、Esc か空にすると元に戻す", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableLists(page);
  await page.goto("/lists");
  await page.getByRole("toolbar", { name: "リストの操作" }).getByRole("button", { name: "リストを作る" }).click();
  await page.getByRole("dialog", { name: "リストを作る" }).getByLabel("名前").fill("買い物");
  await page.getByRole("dialog", { name: "リストを作る" }).getByRole("button", { name: "作る" }).click();
  await expect(page).toHaveURL(/\/lists\/.+/);

  const addInput = page.getByLabel("項目を足す");
  await addInput.fill("にんじん");
  await addInput.press("Enter");
  await expect(page.getByText("にんじん")).toBeVisible();

  // 文字を押すと入力欄になり、Enter で保存する
  await page.getByRole("button", { name: "にんじん を直す" }).click();
  const editInput = page.getByLabel("にんじん を直す");
  await expect(editInput).toBeFocused();
  await editInput.fill("大根");
  await editInput.press("Enter");
  await expect(page.getByText("大根")).toBeVisible();
  await expect(page.getByText("にんじん")).toHaveCount(0);

  // Esc は保存せず、元の文字に戻る
  await page.getByRole("button", { name: "大根 を直す" }).click();
  await page.getByLabel("大根 を直す").fill("ねぎ");
  await page.keyboard.press("Escape");
  await expect(page.getByText("大根")).toBeVisible();
  await expect(page.getByText("ねぎ")).toHaveCount(0);

  // 空にして確定すると、元の文字のまま残る
  await page.getByRole("button", { name: "大根 を直す" }).click();
  await page.getByLabel("大根 を直す").fill("");
  await page.keyboard.press("Enter");
  await expect(page.getByText("大根")).toBeVisible();

  // チェックの押せる範囲と、文字を直す範囲は重ならない
  const carrot = page.getByRole("checkbox", { name: "大根 をチェックする" });
  await carrot.click();
  await expect(carrot).toBeChecked();
  await expect(page.getByRole("button", { name: "大根 を直す" })).toBeVisible();
});

test("項目を足す欄の右の「足す」ボタンで足せる。文字が空だと押せない", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableLists(page);
  await page.goto("/lists");
  await page.getByRole("toolbar", { name: "リストの操作" }).getByRole("button", { name: "リストを作る" }).click();
  await page.getByRole("dialog", { name: "リストを作る" }).getByLabel("名前").fill("買い物");
  await page.getByRole("dialog", { name: "リストを作る" }).getByRole("button", { name: "作る" }).click();
  await expect(page).toHaveURL(/\/lists\/.+/);

  const addInput = page.getByLabel("項目を足す");
  const addButton = page.getByRole("button", { name: "足す" });
  await expect(addButton).toBeDisabled();

  await addInput.fill("にんじん");
  await expect(addButton).toBeEnabled();
  await addButton.click();
  await expect(page.getByText("にんじん")).toBeVisible();
  // 足したら欄を空に戻し、続けて入力できる。フォーカスも入力欄に戻る
  await expect(addInput).toHaveValue("");
  await expect(addInput).toBeFocused();
  await expect(addButton).toBeDisabled();

  // キーボードの Enter でも今までどおり足せる
  await addInput.fill("たまねぎ");
  await addInput.press("Enter");
  await expect(page.getByText("たまねぎ")).toBeVisible();
});

test("リストの日付は日本時間の今日になる。日本時間の夜(世界時でも同じ日)", async ({ page }) => {
  const fixed = new Date("2026-09-24T21:52:00+09:00");
  const today = jstDateKeyAt(fixed);
  expect(today).toBe("2026-09-24");

  await signUp(page, { name: "こた" });
  await page.clock.setFixedTime(fixed);
  await page.reload();
  await enableLists(page);
  await page.goto("/lists");
  await page.getByRole("toolbar", { name: "リストの操作" }).getByRole("button", { name: "リストを作る" }).click();
  const create = page.getByRole("dialog", { name: "リストを作る" });
  await create.getByLabel("名前").fill("買い物");
  await create.getByLabel("日付").fill(today);
  await create.getByRole("button", { name: "作る" }).click();
  await expect(page).toHaveURL(/\/lists\/.+/);
  await expect(page.getByText("9月24日 のカレンダーに出ています")).toBeVisible();

  // カレンダーの既定(今日)にも、指定した日にも同じく出る
  await page.goto("/");
  await expect(dayPanel(page).getByRole("button", { name: /買い物/ })).toBeVisible();
  await page.goto(`/?date=${today}`);
  await expect(dayPanel(page).getByRole("button", { name: /買い物/ })).toBeVisible();
});

test("リストの日付は日本時間の今日になる。日本時間の朝(世界時では前日)", async ({ page }) => {
  const fixed = new Date("2026-09-25T03:00:00+09:00");
  const today = jstDateKeyAt(fixed);
  expect(today).toBe("2026-09-25");
  expect(fixed.getUTCDate()).toBe(24); // 世界時ではまだ前日の 24 日

  await signUp(page, { name: "こた" });
  await page.clock.setFixedTime(fixed);
  await page.reload();
  await enableLists(page);
  await page.goto("/lists");
  await page.getByRole("toolbar", { name: "リストの操作" }).getByRole("button", { name: "リストを作る" }).click();
  const create = page.getByRole("dialog", { name: "リストを作る" });
  await create.getByLabel("名前").fill("買い物");
  await create.getByLabel("日付").fill(today);
  await create.getByRole("button", { name: "作る" }).click();
  await expect(page).toHaveURL(/\/lists\/.+/);
  await expect(page.getByText("9月25日 のカレンダーに出ています")).toBeVisible();

  // カレンダーの既定(今日)にも、指定した日にも同じく出る
  await page.goto("/");
  await expect(dayPanel(page).getByRole("button", { name: /買い物/ })).toBeVisible();
  await page.goto(`/?date=${today}`);
  await expect(dayPanel(page).getByRole("button", { name: /買い物/ })).toBeVisible();
});
