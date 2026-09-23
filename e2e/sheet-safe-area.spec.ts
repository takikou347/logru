import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

/**
 * iPhone の PWA では、上の安全な余白(env(safe-area-inset-top))がシートの上にかかる。
 * Playwright はこの値を作れないので、代わりに --safe-top を書き換えて確かめる。issue #149
 *
 * 高さを小さくして、シートの中身が高さの上限にぶつかるようにする。中身が上限より低ければ、
 * 直す前の形でも閉じるボタンは画面に収まってしまい、直しの効果を確かめられない
 */
test.use({ viewport: { width: 390, height: 700 } });

test.beforeEach(async ({ page }) => {
  await signUp(page);
  await page.evaluate(() => document.documentElement.style.setProperty("--safe-top", "47px"));
});

test("上の安全な余白を大きくしても、閉じるボタンは画面の中にある。シートは安全な余白の下から始まる", async ({
  page,
}) => {
  // 繰り返しを開いて中身を増やし、シートの高さが上限にぶつかるようにする
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await expect(sheet).toBeVisible({ timeout: 15_000 });
  await sheet.getByLabel("題名").fill("長いシートの確認");
  await sheet.getByRole("radio", { name: "毎週" }).click();
  await sheet.getByRole("radiogroup", { name: "繰り返しの終わり" }).getByRole("radio", { name: "日付" }).click();

  // CI は手元より遅いことがあるため、ここだけ長めに待つ
  const close = sheet.getByRole("button", { name: "Close" });
  await expect(close).toBeInViewport({ timeout: 15_000 });
  const closeBox = (await close.boundingBox())!;
  // 47px の安全な余白より下にある。上限の計算に --safe-top を見込んでいないと、ここが 47 より小さくなる
  expect(closeBox.y).toBeGreaterThanOrEqual(47);

  const sheetBox = (await sheet.boundingBox())!;
  expect(sheetBox.y).toBeGreaterThanOrEqual(47);
});

test("日付と時刻の入力は、ほかの入力と同じ幅になる", async ({ page }) => {
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  const titleBox = (await sheet.getByLabel("題名").boundingBox())!;
  const dateBox = (await sheet.getByLabel("日付").boundingBox())!;
  expect(Math.abs(dateBox.width - titleBox.width)).toBeLessThanOrEqual(1);

  // 終日でなければ、日付の代わりに始まり・終わりの時刻を選ぶ
  const startBox = (await sheet.getByLabel("始まり").boundingBox())!;
  const endBox = (await sheet.getByLabel("終わり").boundingBox())!;
  expect(Math.abs(startBox.width - endBox.width)).toBeLessThanOrEqual(1);
});
