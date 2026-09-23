import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("予定のシートで毎週の繰り返しを選ぶと、来週にも出る。F-36", async ({ page }) => {
  await page.getByRole("radio", { name: "週", exact: true }).last().click();
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await sheet.getByLabel("題名").fill("毎週の会議");
  await sheet.getByRole("radio", { name: "毎週" }).click();
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予定を足しました")).toBeVisible();

  const week = page.getByRole("region", { name: "週の予定" });
  await expect(week.getByRole("button", { name: /毎週の会議/ })).toBeVisible();

  await page.getByRole("button", { name: "次へ" }).click();
  await expect(week.getByRole("button", { name: /毎週の会議/ })).toBeVisible();
});

test("朝 7 時の予定で毎週を選ぶと、木曜のままになる。UTC では前日になる時刻。0068", async ({ page }) => {
  // 2026-10-01 06:00 は日本時間で木曜。新しい予定の既定は次の正時なので 7:00 になる。UTC では前日水曜 21:00
  await page.clock.setFixedTime(new Date("2026-10-01T06:00:00+09:00"));
  await page.reload();
  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();

  await page.getByRole("radio", { name: "週", exact: true }).last().click();
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await expect(sheet.getByLabel("始まり")).toHaveValue("07:00");
  await sheet.getByLabel("題名").fill("朝のヨガ");
  await sheet.getByRole("radio", { name: "毎週" }).click();

  // 既定の曜日は始まりの日本時間の曜日(木)。UTC の暦なら水になってしまう。0068
  await expect(sheet.getByRole("button", { name: "木", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(sheet.getByRole("button", { name: "水", exact: true })).toHaveAttribute("aria-pressed", "false");

  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予定を足しました")).toBeVisible();

  // 日曜始まりの週の表で、木曜は 5 番目(0 始まりで 4)
  const rows = page.getByRole("region", { name: "週の予定" }).getByTestId("week-row");
  await expect(rows.nth(4)).toContainText("木");
  await expect(rows.nth(4).getByRole("button", { name: /朝のヨガ/ })).toBeVisible();
  await expect(rows.nth(3).getByRole("button", { name: /朝のヨガ/ })).toHaveCount(0);
});

test("繰り返す予定を消すときは、この回だけ・これ以降・全部を選ぶ。0043", async ({ page }) => {
  await page.getByRole("radio", { name: "週", exact: true }).last().click();
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await sheet.getByLabel("題名").fill("毎週のジム");
  await sheet.getByRole("radio", { name: "毎週" }).click();
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予定を足しました")).toBeVisible();

  const week = page.getByRole("region", { name: "週の予定" });
  const item = week.getByRole("button", { name: /毎週のジム/ });
  await item.click();
  await page.getByRole("dialog", { name: "予定を直す" }).getByRole("button", { name: "予定を消す" }).click();

  const scope = page.getByRole("dialog", { name: "どの回を消しますか" });
  await expect(scope).toBeVisible();
  await expect(scope.getByRole("button", { name: "この回だけ" })).toBeVisible();
  await expect(scope.getByRole("button", { name: "これ以降" })).toBeVisible();
  await expect(scope.getByRole("button", { name: "全部" })).toBeVisible();
  await scope.getByRole("button", { name: "この回だけ" }).click();

  // 今回だけ消え、「元に戻す」で戻せる。ほかの回に影響しないことは worker のテストで確かめている
  await expect(item).toBeHidden();
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(item).toBeVisible();
});
