import { expect, test } from "@playwright/test";
import { addExtension, enableNewLook, signUp } from "./helpers";

/**
 * 刷新 4。画面の移り変わり(行がシートに広がる、節が機能の画面に広がる)。0093、F-46、issue #241
 *
 * ラボの「新しい見た目」を入れたスマホだけに出る。行 → シート、節・タイル → 機能の画面の
 * 共有要素は View Transitions API の名前(view-transition-name)を付けて作る。名前は要素の
 * インラインスタイルに残るので、`[style*="..."]` で付いているかを確かめる。
 */

test("新しい見た目で、予定の行を押すとシートに広がる動きの名前が付き、閉じると元の行の位置に戻る", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableNewLook(page);

  await page.goto("/?new=1");
  const newSheet = page.getByRole("dialog", { name: "新しい予定" });
  await newSheet.getByLabel("題名").fill("共有要素確認の予定");
  await newSheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予定を足しました")).toBeVisible();

  const row = page.getByRole("button", { name: /共有要素確認の予定/ });
  await expect(row).toBeVisible();
  const before = await row.boundingBox();

  // 押す前は、行にも他のどこにも row-expand の名前は付いていない
  await expect(page.locator('[style*="row-expand"]')).toHaveCount(0);

  await row.click();
  const editSheet = page.getByRole("dialog", { name: "予定を直す" });
  await expect(editSheet).toBeVisible();
  // シートが、押した行から広がる動き(共有要素)の名前を持つ
  await expect(page.locator('[style*="row-expand"]')).toHaveCount(1);

  await editSheet.getByRole("button", { name: "閉じる" }).click();
  await expect(editSheet).toBeHidden();

  // 閉じ終えると、名前は誰も持たない。行は元の位置のまま
  await expect(page.locator('[style*="row-expand"]')).toHaveCount(0);
  const after = await row.boundingBox();
  expect(after).toEqual(before);
});

test("家計簿の記録の行を押すとシートに広がる動きの名前が付く", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableNewLook(page);
  await addExtension(page, "家計簿");

  // 新しい見た目のスマホでは、下の帯(Dock)は「+」の放射に隠れる(0091)。今日のページの
  // 家計簿の節の近道から、記録するシートを開く
  await page.goto("/");
  await page.getByTestId("today-section-kakeibo").getByRole("link", { name: "支出を記録する" }).click();
  const newSheet = page.getByRole("dialog", { name: "記録する" });
  await newSheet.getByLabel("金額").fill("980");
  await newSheet.getByRole("radio", { name: "食費" }).click();
  await newSheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();

  // KakeiboPage 自身の記録の行(RecordRow)を押す
  await page.goto("/kakeibo");
  const row = page.getByRole("button", { name: /食費/ }).first();
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByRole("dialog", { name: "記録を直す" })).toBeVisible();
  await expect(page.locator('[style*="row-expand"]')).toHaveCount(1);
});

test("動きを減らす設定では、行を押しても共有要素の名前を付けない。シートは開く", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableNewLook(page);
  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.goto("/?new=1");
  const newSheet = page.getByRole("dialog", { name: "新しい予定" });
  await newSheet.getByLabel("題名").fill("動きを減らす確認");
  await newSheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予定を足しました")).toBeVisible();

  const row = page.getByRole("button", { name: /動きを減らす確認/ });
  await row.click();
  await expect(page.getByRole("dialog", { name: "予定を直す" })).toBeVisible();
  await expect(page.locator('[style*="row-expand"]')).toHaveCount(0);
});

test("ラボの「新しい見た目」を入れていない人は、行を押しても共有要素の名前を付けない", async ({ page }) => {
  await signUp(page, { name: "こた" });

  await page.goto("/?new=1");
  const newSheet = page.getByRole("dialog", { name: "新しい予定" });
  await newSheet.getByLabel("題名").fill("入れていない人の確認");
  await newSheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予定を足しました")).toBeVisible();

  const row = page.getByRole("button", { name: /入れていない人の確認/ }).first();
  await row.click();
  await expect(page.getByRole("dialog", { name: "予定を直す" })).toBeVisible();
  await expect(page.locator('[style*="row-expand"]')).toHaveCount(0);
});

test("節の見出しを押すと機能の画面へ広がる動きの名前が付いて移り、戻ると今日のページの元の場所に戻る", async ({
  page,
}) => {
  await signUp(page, { name: "こた" });
  await enableNewLook(page);
  await addExtension(page, "家計簿");

  await page.goto("/");
  await expect(page.getByTestId("today-section-kakeibo")).toBeVisible();
  await page.getByTestId("today-section-kakeibo").getByRole("link", { name: "家計簿" }).click();

  await expect(page).toHaveURL(/\/kakeibo$/);
  await expect(page.getByTestId("kakeibo-total")).toBeVisible();
  // 行き先の面(Page)が、押した見出しから広がる動き(共有要素)の名前を持つ
  await expect(page.locator('[style*="box-expand"]')).toHaveCount(1);

  await page.goBack();
  await expect(page).toHaveURL("/");
  await expect(page.getByTestId("today-section-kakeibo")).toBeVisible();
});

test("機能のタイルを押すと機能の画面へ広がる動きの名前が付く", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableNewLook(page);
  await addExtension(page, "家計簿");

  await page.goto("/settings/extensions");
  await page.getByTestId("extension-tile-kakeibo").click();
  await expect(page).toHaveURL(/\/kakeibo$/);
  await expect(page.locator('[style*="box-expand"]')).toHaveCount(1);
});

test("ラボの「新しい見た目」を入れていない人は、節・タイルを押しても共有要素の名前を付けない", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await addExtension(page, "家計簿");

  await page.goto("/settings/extensions");
  await page.getByTestId("extension-tile-kakeibo").click();
  await expect(page).toHaveURL(/\/kakeibo$/);
  await expect(page.locator('[style*="box-expand"]')).toHaveCount(0);
});
