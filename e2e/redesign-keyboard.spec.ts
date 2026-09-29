import { expect, type Locator, test } from "@playwright/test";
import { addExtension, closeMobileKeyboard, enableOldLook, openMobileKeyboard, signUp } from "./helpers";

/**
 * 刷新 5。入力のシートを OS のキーボードに合わせる(保存をキーボードの上に)。0094、issue #242
 *
 * 新しい見た目はスマホの既定で出る。Playwright は実機のキーボードを起こせないので、
 * `openMobileKeyboard`(helpers.ts)で `visualViewport` を縮め、`resize` を起こして近づける。
 */

/** 実機の数字キーパッド・かなキーパッドの見当の高さ(px) */
const NUMERIC_KEYBOARD_PX = 291;
const KANA_KEYBOARD_PX = 346;

/** 欄がキーボードより上の見える範囲に収まっているか(上端も下端も) */
async function expectWithinKeyboardViewport(locator: Locator, keyboardTop: number) {
  await expect(async () => {
    const box = await locator.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(keyboardTop + 2);
  }).toPass({ timeout: 5_000 });
}

/** シートの下端が、キーボードの上端から 2px 以内にあるか(隙間が無いか) */
async function expectSheetFlushWithKeyboard(sheet: Locator, keyboardTop: number) {
  await expect(async () => {
    const box = await sheet.boundingBox();
    expect(box).toBeTruthy();
    expect(Math.abs(box!.y + box!.height - keyboardTop)).toBeLessThanOrEqual(2);
  }).toPass({ timeout: 5_000 });
}

/** 2 つの欄の四角が重ならないか */
async function expectNoOverlap(a: Locator, b: Locator) {
  await expect(async () => {
    const [boxA, boxB] = await Promise.all([a.boundingBox(), b.boundingBox()]);
    expect(boxA).toBeTruthy();
    expect(boxB).toBeTruthy();
    const overlap =
      boxA!.x < boxB!.x + boxB!.width &&
      boxA!.x + boxA!.width > boxB!.x &&
      boxA!.y < boxB!.y + boxB!.height &&
      boxA!.y + boxA!.height > boxB!.y;
    expect(overlap).toBe(false);
  }).toPass({ timeout: 5_000 });
}

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("支出のシート。キーボードが出ると持ち上がり、保存がキーボードの上に来て、下のタブの帯が隠れる", async ({
  page,
}) => {
  await addExtension(page, "家計簿");
  await page.goto("/kakeibo?record=1");
  const sheet = page.getByRole("dialog", { name: "記録する" });
  await expect(sheet).toBeVisible();

  const viewport = page.viewportSize();
  if (!viewport) throw new Error("viewport が取れません");
  const keyboardTop = viewport.height - NUMERIC_KEYBOARD_PX;

  const amount = sheet.getByLabel("金額");
  await amount.focus();
  await openMobileKeyboard(page, NUMERIC_KEYBOARD_PX);

  // 下のタブの帯が隠れる
  await expect(page.getByRole("navigation", { name: "下のタブ" })).toBeHidden();

  // シートの下端が、キーボードの上端にぴったり合う(隙間が無い)
  await expectSheetFlushWithKeyboard(sheet, keyboardTop);

  // 保存(アイコンだけ、読み上げの名前は残る)がキーボードの見える範囲に来る
  const save = sheet.getByRole("button", { name: "保存する" });
  await expect(save).toBeVisible();
  await expectWithinKeyboardViewport(save, keyboardTop);

  // 入力中の欄(金額)も、見える範囲に入り、保存の帯と重ならない
  await expectWithinKeyboardViewport(amount, keyboardTop);
  await expectNoOverlap(amount, save);
});

test("支出のシート。帯の前・次で欄を移れ、帯の保存で保存できる", async ({ page }) => {
  await addExtension(page, "家計簿");
  await page.goto("/kakeibo?record=1");
  const sheet = page.getByRole("dialog", { name: "記録する" });
  const amount = sheet.getByLabel("金額");
  await expect(amount).toBeFocused();

  await openMobileKeyboard(page, NUMERIC_KEYBOARD_PX);
  await amount.fill("1280");
  await sheet.getByRole("radio", { name: "食費" }).click();

  // 前の欄・次の欄はアイコンだけ。読み上げの名前は残る
  const next = sheet.getByRole("button", { name: "次の欄へ" });
  const prev = sheet.getByRole("button", { name: "前の欄へ" });
  await expect(next).toBeVisible();
  await expect(prev).toBeVisible();

  await next.click();
  await expect(sheet.getByLabel("日付")).toBeFocused();
  await prev.click();
  await expect(amount).toBeFocused();

  // 帯の保存(アイコンだけ)で保存できる
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();
});

test("予定のシート。キーボードが出ると持ち上がり、Enter は送信でなく次の欄へ移る(次へ)", async ({ page }) => {
  await page.goto("/?new=1");
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await expect(sheet).toBeVisible();
  const title = sheet.getByLabel("題名");
  await expect(title).toBeFocused();

  const viewport = page.viewportSize();
  if (!viewport) throw new Error("viewport が取れません");
  const keyboardTop = viewport.height - KANA_KEYBOARD_PX;

  await openMobileKeyboard(page, KANA_KEYBOARD_PX);
  await expect(page.getByRole("navigation", { name: "下のタブ" })).toBeHidden();

  // シートの下端が、キーボードの上端にぴったり合う(隙間が無い)
  await expectSheetFlushWithKeyboard(sheet, keyboardTop);

  const save = sheet.getByRole("button", { name: "保存する" });
  await title.fill("えいが");
  // 入力中の欄(題名)も、見える範囲に入り、保存の帯と重ならない
  await expectWithinKeyboardViewport(title, keyboardTop);
  await expectNoOverlap(title, save);

  await title.press("Enter");

  // 送信されず(シートは開いたまま、知らせも出ない)、次の欄へ移る
  await expect(sheet).toBeVisible();
  await expect(page.getByText("予定を足しました")).toBeHidden();
  await expect(title).not.toBeFocused();

  // 帯の保存(アイコンだけ)で、あらためて保存できる
  await expectWithinKeyboardViewport(save, keyboardTop);
  await save.click();
  await expect(page.getByText("予定を足しました")).toBeVisible();
});

test("リストに足す欄。シートを使わず、キーボードが出るとキーボードのすぐ上に付き、下のタブの帯が隠れる", async ({
  page,
}) => {
  // リストを作る操作(「リストの操作」の Dock)は新しい見た目・スマホでは下のタブの帯に役目が
  // 移り、隠れる(0091)。まだ 1 つも無いので、空の案内の「リストを作る」から作る
  await addExtension(page, "リスト");
  await page.goto("/lists");
  await page.getByRole("button", { name: "リストを作る" }).click();
  const create = page.getByRole("dialog", { name: "リストを作る" });
  await create.getByLabel("名前").fill("買い物");
  await create.getByRole("button", { name: "作る" }).click();
  await expect(page).toHaveURL(/\/lists\/.+/);
  const listUrl = page.url();

  await page.goto(listUrl);

  const addInput = page.getByLabel("項目を足す");
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("viewport が取れません");
  const keyboardTop = viewport.height - KANA_KEYBOARD_PX;

  await addInput.click();
  await openMobileKeyboard(page, KANA_KEYBOARD_PX);

  await expect(page.getByRole("navigation", { name: "下のタブ" })).toBeHidden();
  // 入力中の欄(足す欄)も、右の「足す」ボタンも見える範囲に入り、互いに重ならない
  const addButton = page.getByRole("button", { name: "足す" });
  await expectWithinKeyboardViewport(addInput, keyboardTop);
  await expectWithinKeyboardViewport(addButton, keyboardTop);
  await expectNoOverlap(addInput, addButton);

  // 改行で足して、欄は開いたまま続けて打てる。F-203 と同じ動き
  await addInput.fill("ばなな");
  await addInput.press("Enter");
  await expect(page.getByText("ばなな")).toBeVisible();
  await expect(addInput).toHaveValue("");

  await closeMobileKeyboard(page);
  await expect(page.getByRole("navigation", { name: "下のタブ" })).toBeVisible();
});

test("前の見た目に戻すを入れた人には、キーボードが出ても今までどおり(下のタブの帯も帯の保存も無い)", async ({
  page,
}) => {
  await enableOldLook(page);
  await addExtension(page, "家計簿");
  await page.goto("/kakeibo?record=1");
  const sheet = page.getByRole("dialog", { name: "記録する" });
  await expect(sheet).toBeVisible();

  await openMobileKeyboard(page, NUMERIC_KEYBOARD_PX);

  // 今までどおりの下の行(やめる・保存する)のまま。帯の「次の欄へ」などは出ない
  await expect(sheet.getByRole("button", { name: "やめる" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "保存する" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "次の欄へ" })).toHaveCount(0);
});
