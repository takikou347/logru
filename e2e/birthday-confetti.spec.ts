import { expect, type Page, test } from "@playwright/test";
import { addEventButton, signUp, tokyoDateParts } from "./helpers";

/**
 * 誕生日・記念日の当日、今日のページを開くと紙吹雪を 1 回だけ降らせる。F-412、0098
 * 日付は日本時間の今日に固定する(CI は UTC で動く)。始まりは 5 年前の今日にして、毎年の回を今日に当てる。
 */
const today = tokyoDateParts();
const startDate = `${today.year - 5}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`;

async function addYearlyEvent(page: Page, title: string) {
  await addEventButton(page);
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await sheet.getByLabel("題名").fill(title);
  await sheet.getByLabel("日付").fill(startDate);
  await sheet.getByRole("radio", { name: "毎年" }).click();
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予定を足しました")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await signUp(page, { next: "/" });
});

test("今日が誕生日なら、開いたとき紙吹雪が降り、約 1.5 秒で消える。2 回目は降らない", async ({ page }) => {
  await page.goto("/");
  await addYearlyEvent(page, "けんたの誕生日");
  await page.goto("/");
  const confetti = page.getByTestId("confetti");
  await expect(confetti).toBeAttached();
  // 操作を邪魔しない
  await expect(confetti).toHaveCSS("pointer-events", "none");
  await expect(confetti).not.toBeAttached({ timeout: 4_000 });
  // 同じ日の 2 回目は降らない
  await page.reload();
  await expect(page.getByTestId("today-day-number")).toBeVisible();
  await page.waitForTimeout(800);
  await expect(confetti).toHaveCount(0);
});

test("動きを減らす設定では降らず、印も付かない", async ({ page }) => {
  await page.goto("/");
  await addYearlyEvent(page, "けんたの誕生日");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByTestId("today-day-number")).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page.getByTestId("confetti")).toHaveCount(0);
  // 設定を戻して開き直すと、その日はまだ降っていないので降る
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.getByTestId("confetti")).toBeAttached();
});

test("誕生日の予定が無い日は降らない", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("today-day-number")).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page.getByTestId("confetti")).toHaveCount(0);
});
