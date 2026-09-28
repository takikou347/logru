import { expect, type Page, test } from "@playwright/test";
import { addExtension, enableOldLook, signUp, swipeHorizontal, touchDrag } from "./helpers";

/** 今日のページに出ている節(today-section-*)の、画面の上からの並び。key だけ(今日-section- の後ろ)を返す */
async function sectionOrder(page: Page): Promise<string[]> {
  const ids = await page
    .locator('[data-testid^="today-section-"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")));
  return ids.filter((id): id is string => id !== null);
}

/**
 * 刷新 3。ホームを「今日のページ」にし、機能の節と日めくりを作る。0092、F-45、issue #240
 *
 * 新しい見た目はスマホ(1024px 未満)の既定。ラボの「前の見た目に戻す」を入れた人と PC は
 * 今までのカレンダー(月・週・日)のまま(既存の redesign-shell、home-widgets、calendar 系の
 * E2E が確かめる)。
 *
 * 「7 つ以上で畳む」は、今の拡張の一覧では機能が 4 つ(予定・家計簿・共有リスト・思い出)しか
 * 無く、実の画面では試せない。並べ方・畳み方の計算は tests/client/today-sections.test.ts の
 * Vitest で確かめる。
 */

test.beforeEach(async ({ page }) => {
  await signUp(page, { next: "/" });
});

test("新しい見た目で今日のページが出る。予定の節が並ぶ", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("today-day-number")).toBeVisible();
  await expect(page.getByTestId("today-section-events")).toBeVisible();
});

test("前の見た目に戻すを入れた人は今までのまま。今日のページは出ない", async ({ page }) => {
  await enableOldLook(page);
  await page.goto("/");
  await expect(page.getByTestId("today-day-number")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();
});

test("節は足した機能の分だけ並ぶ", async ({ page }) => {
  await addExtension(page, "家計簿");
  await addExtension(page, "リスト");
  await page.goto("/");
  await expect(page.getByTestId("today-section-events")).toBeVisible();
  await expect(page.getByTestId("today-section-kakeibo")).toBeVisible();
  await expect(page.getByTestId("today-section-lists")).toBeVisible();
});

test("節の最後の行(近道)から、予定を足すシートが開く", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("today-section-events").getByRole("link", { name: "予定を足す" }).click();
  await expect(page.getByRole("dialog", { name: "新しい予定" })).toBeVisible();
});

test("家計簿の節の近道から、支出を記録するシートが開く", async ({ page }) => {
  await addExtension(page, "家計簿");
  await page.goto("/");
  await page.getByTestId("today-section-kakeibo").getByRole("link", { name: "支出を記録する" }).click();
  await expect(page.getByRole("dialog", { name: "記録する" })).toBeVisible();
});

test("見出しや余白を左右にスワイプすると日が変わる", async ({ page }) => {
  await page.goto("/");
  // スワイプの途中は、隣の日の複製(top)も同じ testid を持つので、常に先頭(base、送った先)を見る。
  // DayFlipDeck の base は renderPage を先に描くので、複製が挿さっても .first() は base のまま
  const dayNumber = page.getByTestId("today-day-number").first();
  const before = await dayNumber.textContent();

  // 見出し(余白)を左へスワイプ。行の外なので日めくりが効く
  await swipeHorizontal(dayNumber, -220);
  await expect(async () => {
    const after = await dayNumber.textContent();
    expect(after).not.toBe(before);
  }).toPass({ timeout: 5_000 });
  const afterNext = await dayNumber.textContent();

  // 右へスワイプすると、前の日(元の日)へ戻る
  await swipeHorizontal(dayNumber, 220);
  await expect(async () => {
    const after = await dayNumber.textContent();
    expect(after).toBe(before);
    expect(after).not.toBe(afterNext);
  }).toPass({ timeout: 5_000 });
});

test("行の上のスワイプでは日は変わらない。行は押すと開く", async ({ page }) => {
  await page.goto("/?new=1");
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await sheet.getByLabel("題名").fill("スワイプ確認の予定");
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予定を足しました")).toBeVisible();

  const dayNumber = page.getByTestId("today-day-number");
  const before = await dayNumber.textContent();
  const row = page.getByRole("button", { name: /スワイプ確認の予定/ });
  await expect(row).toBeVisible();

  // 行の上を左へスワイプしても、日は変わらない(行の外だけで日めくりが効く)
  await swipeHorizontal(row, -220);
  await page.waitForTimeout(300);
  expect(await dayNumber.textContent()).toBe(before);

  // 行は押すと開く(直す・消すの決定 0084 とは別に、タップでシートを開く今までの動き)
  await row.click();
  await expect(page.getByRole("dialog", { name: "予定を直す" })).toBeVisible();
});

test("動きを減らす設定でも、スワイプで日は変わる", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const dayNumber = page.getByTestId("today-day-number");
  const before = await dayNumber.textContent();
  await swipeHorizontal(dayNumber, -220);
  await expect(async () => {
    expect(await dayNumber.textContent()).not.toBe(before);
  }).toPass({ timeout: 5_000 });
});

test("機能の画面で、今日のページの節の開閉を決めると、読み直しても残る", async ({ page }) => {
  await addExtension(page, "家計簿");
  await page.goto("/settings/extensions");
  await expect(page.getByTestId("today-prefs-toggle-kakeibo")).toBeVisible();

  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/me/today-page") && r.request().method() === "PUT"),
    page.getByTestId("today-prefs-toggle-kakeibo").click(),
  ]);
  expect(resp.ok()).toBe(true);

  await page.goto("/");
  await expect(page.getByTestId("today-section-kakeibo")).toHaveCount(0);
  await expect(page.getByTestId("today-folded-kakeibo")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("today-section-kakeibo")).toHaveCount(0);
  await expect(page.getByTestId("today-folded-kakeibo")).toBeVisible();

  // 畳んだ札を押すと、その場で節が開く
  await page.getByTestId("today-folded-kakeibo").click();
  await expect(page.getByTestId("today-section-kakeibo")).toBeVisible();
});

test("機能の画面で、自分で並べるを選ぶと、機能のタイルの並びが今日のページの節の並びになる", async ({ page }) => {
  await addExtension(page, "家計簿");
  await addExtension(page, "リスト");
  await page.goto("/settings/extensions");

  await page.getByRole("radio", { name: "自分で並べる" }).click();

  // タイルの並びを変える(既存の並べ替えの仕組み。issue #145、#121)
  await page.getByRole("button", { name: "並びを変える" }).click();
  const grid = page.getByTestId("extension-tile-grid");
  const listsHandle = grid.locator('[data-testid="extension-tile-lists"]').getByTestId("tile-drag-handle");
  const kakeiboTile = grid.locator('[data-testid="extension-tile-kakeibo"]');
  await listsHandle.scrollIntoViewIfNeeded();
  const from = await listsHandle.boundingBox();
  const to = await kakeiboTile.boundingBox();
  if (!from || !to) throw new Error("タイルの位置が取れなかった");
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/me/extension-order") && r.request().method() === "PUT"),
    touchDrag(
      page,
      { x: from.x + from.width / 2, y: from.y + from.height / 2 },
      { x: to.x + to.width / 2, y: to.y + to.height / 2 },
    ),
  ]);
  expect(resp.ok()).toBe(true);
  await page.getByRole("button", { name: "完了" }).click();

  await page.goto("/");
  // グループを読み終えるまでは、いつも有効な拡張(予定)だけになる。読み終えるのを待ってから並びを見る
  await expect(page.getByTestId("today-section-kakeibo")).toBeVisible();
  await expect(page.getByTestId("today-section-lists")).toBeVisible();
  const order = await sectionOrder(page);
  expect(order.indexOf("today-section-lists")).toBeLessThan(order.indexOf("today-section-kakeibo"));

  await page.reload();
  await expect(page.getByTestId("today-section-kakeibo")).toBeVisible();
  await expect(page.getByTestId("today-section-lists")).toBeVisible();
  const reloadedOrder = await sectionOrder(page);
  expect(reloadedOrder.indexOf("today-section-lists")).toBeLessThan(reloadedOrder.indexOf("today-section-kakeibo"));
});
