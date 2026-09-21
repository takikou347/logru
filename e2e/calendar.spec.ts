import { expect, test } from "@playwright/test";
import { addEvent, dayPanel, signUp } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("予定を足すと、選んだ日の欄に出る", async ({ page }) => {
  await addEvent(page, "歯医者");
  const panel = dayPanel(page);
  await expect(panel.getByRole("button", { name: /歯医者/ })).toBeVisible();
  await expect(panel.getByText("自分")).toBeVisible();
});

test("題名が空なら保存できない", async ({ page }) => {
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await expect(sheet.getByRole("button", { name: "保存する" })).toBeDisabled();
  await sheet.getByLabel("題名").fill("   ");
  await expect(sheet.getByRole("button", { name: "保存する" })).toBeDisabled();
});

test("予定を直せる", async ({ page }) => {
  await addEvent(page, "買い物");
  await dayPanel(page).getByRole("button", { name: /買い物/ }).click();
  const sheet = page.getByRole("dialog", { name: "予定を直す" });
  await sheet.getByLabel("題名").fill("夕飯の買い出し");
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予定を保存しました")).toBeVisible();
  await expect(dayPanel(page).getByRole("button", { name: /夕飯の買い出し/ })).toBeVisible();
});

test("終日の予定は、終わりの日まで出る", async ({ page }) => {
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await sheet.getByLabel("題名").fill("旅行");
  await sheet.getByRole("switch", { name: "終日" }).click();
  const start = await sheet.getByLabel("始まりの日").inputValue();
  const end = new Date(`${start}T00:00:00`);
  end.setDate(end.getDate() + 1);
  const endKey = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  await sheet.getByLabel("終わりの日").fill(endKey);
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(dayPanel(page).getByRole("button", { name: /終日\s*旅行/ })).toBeVisible();
  await page.goto(`/?date=${endKey}`);
  await expect(dayPanel(page).getByRole("button", { name: /旅行/ })).toBeVisible();
});

test("消すと 5 秒だけ元に戻せる", async ({ page }) => {
  await addEvent(page, "ジム");
  const item = dayPanel(page).getByRole("button", { name: /ジム/ });
  await item.click();
  await page.getByRole("dialog", { name: "予定を直す" }).getByRole("button", { name: "予定を消す" }).click();
  await expect(item).toBeHidden();
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(item).toBeVisible();

  await item.click();
  await page.getByRole("dialog", { name: "予定を直す" }).getByRole("button", { name: "予定を消す" }).click();
  await expect(item).toBeHidden();
  // 5 秒たつと本当に消え、読み込み直しても出ない
  await page.waitForTimeout(6_000);
  await page.reload();
  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();
  await expect(dayPanel(page).getByRole("button", { name: /ジム/ })).toHaveCount(0);
});

test("日付を押すと選ぶだけで、シートは開かない", async ({ page }) => {
  const grid = page.getByRole("region", { name: "月の表" });
  await grid.locator('[data-date="15"]:not([data-out]) button').first().click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/date=\d{4}-\d{2}-15/);
  await expect(page.getByTestId("big-day")).toHaveText("15");
});

test("長押しすると、その日の予定を足すシートが開く", async ({ page }) => {
  const cell = page.getByRole("region", { name: "月の表" }).locator('[data-date="12"]:not([data-out]) button').first();
  const box = (await cell.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel("日付")).toHaveValue(/-12$/);
});

test("今日には読み上げ用の印が付き、月を移ると今日のボタンが出る", async ({ page }) => {
  await expect(page.locator('[aria-current="date"]')).toHaveCount(1);
  await expect(page.getByRole("button", { name: "今日", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "次の月" }).click();
  await expect(page.locator('[aria-current="date"]')).toHaveCount(0);
  await page.getByRole("button", { name: "今日", exact: true }).click();
  await expect(page.locator('[aria-current="date"]')).toHaveCount(1);
});

test("週と日の表示に切り替えられる", async ({ page }) => {
  await addEvent(page, "会議");
  await page.getByRole("radio", { name: "週" }).last().click();
  await expect(page.getByRole("region", { name: "週の予定" })).toBeVisible();
  await expect(page.getByRole("region", { name: "週の予定" }).getByTestId("week-row")).toHaveCount(7);
  await expect(page.getByRole("button", { name: /会議/ })).toBeVisible();
  await page.getByRole("radio", { name: "日" }).last().click();
  await expect(page.getByRole("region", { name: "日の予定" }).getByTestId("week-row")).toHaveCount(1);
});

test("祝日は名前が出る", async ({ page }) => {
  await page.goto("/?date=2026-09-21");
  await expect(dayPanel(page)).toContainText("敬老の日");
  await expect(dayPanel(page).locator("[data-tone]")).toHaveAttribute("data-tone", "sun");
});
