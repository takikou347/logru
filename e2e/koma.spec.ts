import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

const PHOTO = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/photo.jpg");

/** 日本時間のいまの時。ひとコマは 7 時台から 22 時台だけ撮れる */
const hourInTokyo = () =>
  Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", hourCycle: "h23" }).format(new Date()),
  );
const inKomaHours = () => hourInTokyo() >= 7 && hourInTokyo() <= 22;

test("思い出が無い日でも、今日をひとコマで始め、近道の帯から撮れる。F-121、F-126、F-127", async ({ page }) => {
  test.skip(!inKomaHours(), "ひとコマは日本時間の 7 時台から 22 時台だけ撮れる");
  await signUp(page, { name: "こた" });
  await page.goto("/settings/extensions");
  await page.getByRole("switch", { name: "思い出を使う" }).click();

  // 機能のシートの「ひとコマ」から確認画面へ。今日を始める
  await page.goto("/");
  await page.getByRole("toolbar", { name: "カレンダーの操作" }).getByRole("button", { name: "機能" }).click();
  await page
    .getByRole("dialog", { name: "機能" })
    .getByRole("link", { name: /ひとコマ/ })
    .click();
  await page.getByRole("button", { name: "今日のひとコマを始める" }).click();
  const start = page.getByRole("dialog", { name: "今日のひとコマを始める" });
  await expect(start.getByRole("radio", { name: "自分だけ" })).toHaveAttribute("aria-checked", "true");
  await start.getByRole("button", { name: "始める" }).click();
  await expect(page.getByText("今日のひとコマを始めました")).toBeVisible();

  // カレンダーの上に近道の帯が出て、1 タップで撮る画面が開く
  await page.goto("/");
  const band = page.getByTestId("shortcut-band").filter({ visible: true });
  await expect(band).toContainText(`${hourInTokyo()} 時のひとコマ`);
  await band.click();
  await expect(page).toHaveURL(/\/memories\/koma\/now$/);

  await page.locator('input[type="file"][capture]').setInputFiles(PHOTO);
  await page.getByLabel("ひとこと").fill("お昼");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText(/時のひとコマを保存しました/)).toBeVisible();

  // 確認画面に今日の 1 枚が出て、帯は消える
  await expect(page).toHaveURL(/\/memories\/koma$/);
  await expect(page.getByRole("button", { name: `${hourInTokyo()} 時 のひとコマ` })).toBeVisible();
  await page.goto("/");
  await expect(page.getByTestId("shortcut-band")).toHaveCount(0);
});

test("ひとコマは思い出を消しても残り、つなぎ直せる。F-128、F-129", async ({ page, request }) => {
  test.skip(!inKomaHours(), "ひとコマは日本時間の 7 時台から 22 時台だけ撮れる");
  await signUp(page, { name: "こた" });
  await page.goto("/settings/extensions");
  await page.getByRole("switch", { name: "思い出を使う" }).click();

  // 今日の日帰りの思い出を、ひとコマを有効にして作る
  await page.goto("/memories");
  await page.getByRole("button", { name: "思い出を作る" }).click();
  const create = page.getByRole("dialog", { name: "思い出を作る" });
  await create.getByLabel("題名").fill("鎌倉 散歩");
  await create.getByRole("switch", { name: "ひとコマを使う" }).click();
  await create.getByRole("button", { name: "作る" }).click();

  // 1 日の面に目盛りが出る。いまの枠から撮る
  const strip = page.getByRole("region", { name: "ひとコマ" });
  await strip.getByRole("link", { name: /のひとコマを撮る/ }).click();
  await page.locator('input[type="file"][capture]').setInputFiles(PHOTO);
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText(/時のひとコマを保存しました/)).toBeVisible();
  await expect(
    page.getByRole("region", { name: "ひとコマ" }).getByRole("button", { name: /のひとコマ$/ }),
  ).toBeVisible();

  // 思い出を消す
  await page.getByRole("button", { name: "思い出を編集" }).click();
  await page.getByRole("dialog", { name: "思い出を編集" }).getByRole("button", { name: "削除" }).click();
  await page.getByRole("dialog", { name: "思い出を削除しますか" }).getByRole("button", { name: "削除する" }).click();
  await expect(page).toHaveURL(/\/memories$/);

  // 確認画面には、つなぎの外れた今日のひとコマが残る
  await page.goto("/memories/koma");
  const link = page.getByRole("button", { name: /の共有先と思い出を変える/ }).first();
  await expect(link).toContainText("思い出を選ぶ");
  await expect(page.getByRole("button", { name: `${hourInTokyo()} 時 のひとコマ` })).toBeVisible();
  void request;
});

test("動きを減らす設定では、ひとコマを保存すると現像も吸い込みもせずすぐに移る。#101", async ({ page }) => {
  test.skip(!inKomaHours(), "ひとコマは日本時間の 7 時台から 22 時台だけ撮れる");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signUp(page, { name: "こた" });
  await page.goto("/extensions");
  await page.getByRole("switch", { name: "思い出を使う" }).click();
  await page.goto("/memories/koma");
  await page.getByRole("button", { name: "今日のひとコマを始める" }).click();
  await page.getByRole("dialog", { name: "今日のひとコマを始める" }).getByRole("button", { name: "始める" }).click();
  await expect(page.getByText("今日のひとコマを始めました")).toBeVisible();
  await page.getByRole("toolbar", { name: "ひとコマの操作" }).getByRole("button").click();
  await expect(page).toHaveURL(/\/memories\/koma\/now$/);

  await page.locator('input[type="file"][capture]').setInputFiles(PHOTO);
  await page.getByRole("button", { name: "保存する" }).click();
  // 動きを減らさない場合は現像(1.2 秒)と吸い込み(0.32 秒)の分だけ遅れて移る。ここではすぐに移ることを確かめる
  await expect(page).toHaveURL(/\/memories\/koma$/, { timeout: 1_000 });
});
