import { expect, type Page, test } from "@playwright/test";
import { addExtension, signUp } from "./helpers";

/**
 * スマホでは、PageBar を持つ画面の上の帯の右に、ホームへ戻る家のボタンを出す。issue #220
 * 「‹」で 3 回押さなくても、どの機能の画面からも 1 回でホーム(カレンダー)へ移れる。ホーム自身と
 * PC(lg 以上)には出さない。「‹」の動きは決定 0070 のまま変えない
 */
test.use({ viewport: { width: 390, height: 844 } });

/** 家のボタンを押し、ホームへ移ったことを確かめる */
async function clickHome(page: Page) {
  const home = page.getByRole("link", { name: "ホームへ" });
  await expect(home).toBeVisible();
  await home.click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();
}

test("口座ごとの記録、ひとコマの今、リストの詳細、設定の機能の詳細から、家のボタンを 1 回押すとホームへ移る", async ({
  page,
}) => {
  await signUp(page, { name: "こた" });

  // 口座ごとの記録。/kakeibo/accounts/:id
  await addExtension(page, "家計簿");
  await page.goto("/kakeibo/accounts");
  await page.getByRole("toolbar", { name: "口座の操作" }).getByRole("button", { name: "口座を作る" }).click();
  const account = page.getByRole("dialog", { name: "口座を作る" });
  await account.getByLabel("名前").fill("現金");
  await account.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("口座を作りました")).toBeVisible();
  await page.getByRole("link", { name: "現金" }).click();
  await expect(page.getByRole("heading", { name: "現金", level: 1 })).toBeVisible();
  // 「‹」も並んで残り、崩れないこと
  await expect(page.getByRole("link", { name: "戻る" })).toBeVisible();
  await clickHome(page);

  // ひとコマの今。/memories/koma/now。時刻は日本時間の 7〜22 時に固定する
  await addExtension(page, "思い出");
  await page.clock.setFixedTime(new Date("2026-09-24T10:00:00+09:00"));
  await page.goto("/memories/koma/now");
  await expect(page.getByRole("heading", { name: "ひとコマ", level: 1 })).toBeVisible();
  await clickHome(page);

  // リストの詳細。/lists/:id
  await addExtension(page, "リスト");
  await page.goto("/lists");
  await page.getByRole("toolbar", { name: "リストの操作" }).getByRole("button", { name: "リストを作る" }).click();
  const list = page.getByRole("dialog", { name: "リストを作る" });
  await list.getByLabel("名前").fill("買い物");
  await list.getByRole("button", { name: "作る" }).click();
  await expect(page).toHaveURL(/\/lists\/.+/);
  await clickHome(page);

  // 設定の機能の詳細。/settings/extensions/:key
  await page.goto("/settings/extensions/external");
  await expect(page.getByRole("heading", { name: "外部のカレンダー", level: 1 })).toBeVisible();
  await clickHome(page);
});

test("ホームには家のボタンが出ない", async ({ page }) => {
  await signUp(page);
  await expect(page.getByRole("link", { name: "ホームへ" })).toHaveCount(0);
});
