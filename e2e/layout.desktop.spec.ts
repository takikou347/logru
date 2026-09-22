import { expect, test } from "@playwright/test";
import { dayPanel, openAccountMenu, signUp } from "./helpers";

let user: { email: string; name: string };

test.beforeEach(async ({ page }) => {
  user = await signUp(page);
});

test("PC では左にメニュー、右に選んだ日の予定を出し、下の操作は出さない", async ({ page }) => {
  await expect(page.getByRole("complementary", { name: "メニュー" })).toBeVisible();
  await expect(dayPanel(page)).toBeVisible();
  await expect(page.getByRole("toolbar", { name: "カレンダーの操作" })).toBeHidden();
});

test("左の列の下のアイコンから、設定を開き、ログアウトできる", async ({ page }) => {
  const aside = page.getByRole("complementary", { name: "メニュー" });
  await expect(aside.getByRole("link", { name: "設定" })).toHaveCount(0);
  let menu = await openAccountMenu(page);
  await expect(menu.getByText(user.email)).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "グループ" })).toHaveCount(0);
  await menu.getByRole("menuitem", { name: "設定" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("link", { name: "戻る" })).toBeHidden();

  menu = await openAccountMenu(page);
  await menu.getByRole("menuitem", { name: "ログアウト" }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("グループの詳しい画面では、PC でも左上の戻るボタンで一覧に戻れる", async ({ page }) => {
  await page.goto("/groups");
  await expect(page.getByRole("link", { name: "戻る" })).toBeHidden();
  await page.getByLabel("グループの名前").fill("ふたり");
  await page.getByRole("button", { name: "作る" }).click();
  await expect(page.getByRole("heading", { name: "ふたり" })).toBeVisible();
  await page.getByRole("link", { name: "戻る" }).click();
  await expect(page).toHaveURL(/\/groups$/);
});

test("N で予定を足すシートが開き、左右の矢印で月を移り、T で今日に戻る", async ({ page }) => {
  const month = page.getByTestId("month-number");
  const before = await month.textContent();
  await page.keyboard.press("ArrowRight");
  await expect(month).not.toHaveText(before!);
  await page.keyboard.press("t");
  await expect(month).toHaveText(before!);
  await page.keyboard.press("n");
  await expect(page.getByRole("dialog", { name: "新しい予定" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("何日も続く予定は、週ごとに 1 本の帯になり、重なる帯は段が分かれ、押すと直すシートが開く", async ({ page }) => {
  /** 月の表を開いてから、終日の予定を足す */
  async function addSpan(title: string, from: string, to: string) {
    await page.goto(`/?date=${from}`);
    await page.getByRole("button", { name: "予定を足す" }).first().click();
    const sheet = page.getByRole("dialog", { name: "新しい予定" });
    await sheet.getByLabel("題名").fill(title);
    await sheet.getByRole("switch", { name: "終日" }).click();
    await sheet.getByLabel("始まりの日").fill(from);
    await sheet.getByLabel("終わりの日").fill(to);
    await sheet.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByText("予定を足しました")).toBeVisible();
  }
  await addSpan("出張", "2026-09-21", "2026-09-25");
  await addSpan("展示会", "2026-09-23", "2026-09-24");
  await addSpan("連休の旅行", "2026-09-26", "2026-09-28");
  await page.goto("/?date=2026-09-01");

  const grid = page.getByRole("region", { name: "月の表" });
  const cell = (n: number) => grid.locator(`[role="gridcell"][data-date="${n}"]:not([data-out])`);

  // 月曜から金曜の予定は、5 マスにわたる 1 本の帯
  const trip = grid.getByRole("button", { name: /^出張/ });
  await expect(trip).toHaveCount(1);
  const tripBox = (await trip.boundingBox())!;
  const mon = (await cell(21).boundingBox())!;
  const fri = (await cell(25).boundingBox())!;
  expect(tripBox.x).toBeLessThan(mon.x + mon.width / 2);
  expect(tripBox.x + tripBox.width).toBeGreaterThan(fri.x + fri.width / 2);

  // 土曜から月曜の予定は、2 つの週に分かれる
  const holiday = grid.getByRole("button", { name: /^連休の旅行/ });
  await expect(holiday).toHaveCount(2);
  const [sat, sun] = [(await holiday.nth(0).boundingBox())!, (await holiday.nth(1).boundingBox())!];
  expect(sun.y).toBeGreaterThan(sat.y + sat.height);

  // 重なる帯は、別の段に出て両方読める
  const fair = grid.getByRole("button", { name: /^展示会/ });
  await expect(fair).toBeVisible();
  const fairBox = (await fair.boundingBox())!;
  expect(fairBox.y).toBeGreaterThanOrEqual(tripBox.y + tripBox.height);

  await trip.click();
  const sheet = page.getByRole("dialog", { name: "予定を直す" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel("題名")).toHaveValue("出張");
});

test("PC でもマスの空いた所を押すと、その日の予定を足すシートが開き、その日の予定が並ぶ", async ({ page }) => {
  await page.goto("/?date=2026-09-15");
  await page.getByRole("button", { name: "予定を足す" }).first().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await sheet.getByLabel("題名").fill("歯医者");
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予定を足しました")).toBeVisible();
  await page.goto("/?date=2026-09-01");

  // 予定の名前の下の、空いた所を押す
  const cell = page
    .getByRole("region", { name: "月の表" })
    .locator('[data-date="15"]:not([data-out]) > button')
    .first();
  const box = (await cell.boundingBox())!;
  await cell.click({ position: { x: box.width / 2, y: box.height - 10 } });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel("日付")).toHaveValue("2026-09-15");
  await expect(page).toHaveURL(/date=2026-09-15/);
  await sheet
    .getByRole("region", { name: "9月15日の予定" })
    .getByRole("button", { name: /歯医者/ })
    .click();
  await expect(page.getByRole("dialog", { name: "予定を直す" }).getByLabel("題名")).toHaveValue("歯医者");
});

test("PC ではマスに予定名が出て、押すと直すシートが開く", async ({ page }) => {
  await page.getByRole("button", { name: "予定を足す" }).first().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await sheet.getByLabel("題名").fill("打ち合わせ");
  await sheet.getByRole("button", { name: "保存する" }).click();
  const chip = page.getByRole("region", { name: "月の表" }).getByRole("button", { name: /打ち合わせ/ });
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(page.getByRole("dialog", { name: "予定を直す" })).toBeVisible();
});
