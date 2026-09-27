import { expect, test } from "@playwright/test";
import { addExtension, closeMobileKeyboard, enableNewLook, openMobileKeyboard, signUp } from "./helpers";

/**
 * 刷新 5。入力のシートを OS のキーボードに合わせる(保存をキーボードの上に)。0094、issue #242
 *
 * ラボの「新しい見た目」を入れた人のスマホだけに出る。Playwright は実機のキーボードを起こせないので、
 * `openMobileKeyboard`(helpers.ts)で `visualViewport` を縮め、`resize` を起こして近づける。
 */

/** 実機の数字キーパッド・かなキーパッドの見当の高さ(px) */
const NUMERIC_KEYBOARD_PX = 291;
const KANA_KEYBOARD_PX = 346;

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("支出のシート。キーボードが出ると持ち上がり、保存がキーボードの上に来て、下のタブの帯が隠れる", async ({
  page,
}) => {
  await enableNewLook(page);
  await addExtension(page, "家計簿");
  await page.goto("/kakeibo?record=1");
  const sheet = page.getByRole("dialog", { name: "記録する" });
  await expect(sheet).toBeVisible();

  const viewport = page.viewportSize();
  if (!viewport) throw new Error("viewport が取れません");
  const keyboardTop = viewport.height - NUMERIC_KEYBOARD_PX;

  await openMobileKeyboard(page, NUMERIC_KEYBOARD_PX);

  // 下のタブの帯が隠れる
  await expect(page.getByRole("navigation", { name: "下のタブ" })).toBeHidden();

  // 保存(アイコンだけ、読み上げの名前は残る)がキーボードの見える範囲に来る
  const save = sheet.getByRole("button", { name: "保存する" });
  await expect(save).toBeVisible();
  await expect(async () => {
    const box = await save.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.y + box!.height).toBeLessThanOrEqual(keyboardTop + 2);
  }).toPass({ timeout: 5_000 });

  // 入力中の欄(金額)も隠れない
  const amount = sheet.getByLabel("金額");
  await expect(async () => {
    const box = await amount.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.y + box!.height).toBeLessThanOrEqual(keyboardTop + 2);
  }).toPass({ timeout: 5_000 });
});

test("支出のシート。帯の前・次で欄を移れ、帯の保存で保存できる", async ({ page }) => {
  await enableNewLook(page);
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
  await enableNewLook(page);
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

  await title.fill("えいが");
  await title.press("Enter");

  // 送信されず(シートは開いたまま、知らせも出ない)、次の欄へ移る
  await expect(sheet).toBeVisible();
  await expect(page.getByText("予定を足しました")).toBeHidden();
  await expect(title).not.toBeFocused();

  // 帯の保存(アイコンだけ)で、あらためて保存できる
  const save = sheet.getByRole("button", { name: "保存する" });
  await expect(async () => {
    const box = await save.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.y + box!.height).toBeLessThanOrEqual(keyboardTop + 2);
  }).toPass({ timeout: 5_000 });
  await save.click();
  await expect(page.getByText("予定を足しました")).toBeVisible();
});

test("リストに足す欄。シートを使わず、キーボードが出るとキーボードのすぐ上に付き、下のタブの帯が隠れる", async ({
  page,
}) => {
  // リストを作る操作(「リストの操作」の Dock)は新しい見た目・スマホでは「+」の放射に役目が移り、
  // 隠れる(0091)。リストを作ってから新しい見た目を入れる
  await addExtension(page, "リスト");
  await page.goto("/lists");
  await page.getByRole("toolbar", { name: "リストの操作" }).getByRole("button", { name: "リストを作る" }).click();
  const create = page.getByRole("dialog", { name: "リストを作る" });
  await create.getByLabel("名前").fill("買い物");
  await create.getByRole("button", { name: "作る" }).click();
  await expect(page).toHaveURL(/\/lists\/.+/);
  const listUrl = page.url();

  await enableNewLook(page);
  await page.goto(listUrl);

  const addInput = page.getByLabel("項目を足す");
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("viewport が取れません");
  const keyboardTop = viewport.height - KANA_KEYBOARD_PX;

  await addInput.click();
  await openMobileKeyboard(page, KANA_KEYBOARD_PX);

  await expect(page.getByRole("navigation", { name: "下のタブ" })).toBeHidden();
  await expect(async () => {
    const box = await addInput.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.y + box!.height).toBeLessThanOrEqual(keyboardTop + 2);
  }).toPass({ timeout: 5_000 });

  // 改行で足して、欄は開いたまま続けて打てる。F-203 と同じ動き
  await addInput.fill("ばなな");
  await addInput.press("Enter");
  await expect(page.getByText("ばなな")).toBeVisible();
  await expect(addInput).toHaveValue("");

  await closeMobileKeyboard(page);
  await expect(page.getByRole("navigation", { name: "下のタブ" })).toBeVisible();
});

test("新しい見た目を入れていない人には、キーボードが出ても今までどおり(下のタブの帯も帯の保存も無い)", async ({
  page,
}) => {
  // 新しい見た目を入れていない
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
