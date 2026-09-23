import { expect, test } from "@playwright/test";
import { addExtension, signUp } from "./helpers";

/**
 * 下に浮かぶ帯(Dock、カレンダーの下の操作)に、中身のいちばん下が隠れないことを確かめる。
 * globals.css の --dock-clearance を AppLayout の下の余白に使っている。
 */

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

/** 画面のいちばん下までスクロールする */
async function scrollToBottom(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const max = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    window.scrollTo(0, max);
    document.documentElement.scrollTop = max;
    document.body.scrollTop = max;
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const max = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    window.scrollTo(0, max);
  });
  await page.waitForTimeout(200);
}

test("カレンダー: 「このあと」がいくつあっても、下の帯より上に見える", async ({ page }) => {
  for (let i = 0; i < 6; i++) {
    await page.getByRole("button", { name: "予定を足す" }).last().click();
    const sheet = page.getByRole("dialog", { name: "新しい予定" });
    await sheet.getByLabel("題名").fill(`予定 ${i}`);
    const start = new Date(Date.now() + (i + 1) * 86_400_000);
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    await sheet.getByLabel("日付").fill(key);
    await sheet.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await scrollToBottom(page);
  const toolbar = await page.getByRole("toolbar", { name: "カレンダーの操作" }).boundingBox();
  const upcoming = await page.getByRole("region", { name: "このあとの予定" }).boundingBox();
  expect(toolbar).toBeTruthy();
  expect(upcoming).toBeTruthy();
  expect(upcoming!.y + upcoming!.height).toBeLessThanOrEqual(toolbar!.y);
});

test("思い出: 棚がいくつあっても、下の帯より上に見える", async ({ page }) => {
  await addExtension(page, "思い出");
  await page.goto("/memories");
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "思い出を足す" }).click();
    await page.getByRole("dialog", { name: "思い出を足す" }).getByRole("button", { name: "思い出を作る" }).click();
    const create = page.getByRole("dialog", { name: "思い出を作る" });
    await create.getByLabel("題名").fill(`旅行 ${i}`);
    const start = new Date(Date.now() - (i + 2) * 30 * 86_400_000);
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    await create.getByLabel("始まりの日").fill(key);
    await create.getByRole("button", { name: "作る" }).click();
    await page.goto("/memories");
  }
  await scrollToBottom(page);
  const toolbar = await page.getByRole("toolbar", { name: "思い出の操作" }).boundingBox();
  const shelf = await page
    .getByRole("region", { name: /過去の思い出$/ })
    .last()
    .boundingBox();
  expect(toolbar).toBeTruthy();
  expect(shelf).toBeTruthy();
  expect(shelf!.y + shelf!.height).toBeLessThanOrEqual(toolbar!.y);
});

test("家計簿: 記録が無い月でも、空の表示が下の帯より上に見える", async ({ page }) => {
  await addExtension(page, "家計簿");
  await page.goto("/kakeibo");
  await scrollToBottom(page);
  const toolbar = await page.getByRole("toolbar", { name: "家計簿の操作" }).boundingBox();
  const panel = await page.getByRole("region", { name: "記録" }).boundingBox();
  expect(toolbar).toBeTruthy();
  expect(panel).toBeTruthy();
  expect(panel!.y + panel!.height).toBeLessThanOrEqual(toolbar!.y);
});

test("家計簿: 記録がいくつあっても、下の帯より上に見える", async ({ page }) => {
  await addExtension(page, "家計簿");
  await page.goto("/kakeibo");
  for (let i = 0; i < 10; i++) {
    await page.getByRole("button", { name: "支出を記録する" }).click();
    const sheet = page.getByRole("dialog", { name: "記録する" });
    await sheet.getByLabel("金額").fill(String(100 + i));
    await sheet.getByRole("radio", { name: "食費" }).click();
    await sheet.getByRole("button", { name: "保存する" }).click();
  }
  await scrollToBottom(page);
  const toolbar = await page.getByRole("toolbar", { name: "家計簿の操作" }).boundingBox();
  const panel = await page.getByRole("region", { name: "記録" }).boundingBox();
  expect(toolbar).toBeTruthy();
  expect(panel).toBeTruthy();
  expect(panel!.y + panel!.height).toBeLessThanOrEqual(toolbar!.y);
});
