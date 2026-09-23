import { expect, test } from "@playwright/test";
import { signUp, swipeHorizontal } from "./helpers";

/**
 * 月送りの日めくり(#99)と、View Transitions での切り替え(#100)。0049
 */

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("スマホでスワイプすると、前後の月へ移る", async ({ page }) => {
  const monthNumber = page.getByTestId("month-number");
  const before = Number(await monthNumber.innerText());
  const viewport = page.getByTestId("month-flip-viewport");

  // 左へ大きくスワイプ。次の月へ
  await swipeHorizontal(viewport, -220);
  const next = ((before % 12) + 1).toString();
  await expect(monthNumber).toHaveText(next);

  // 右へ大きくスワイプ。もとの月へ戻る
  await swipeHorizontal(viewport, 220);
  await expect(monthNumber).toHaveText(String(before));
});

test("スワイプを途中で離すと、月は変わらない", async ({ page }) => {
  const monthNumber = page.getByTestId("month-number");
  const before = await monthNumber.innerText();
  const viewport = page.getByTestId("month-flip-viewport");

  // 表の幅の 30% に届かない小さな動き。戻るアニメーションの分だけ待つ
  await swipeHorizontal(viewport, -40);
  await page.waitForTimeout(400);
  await expect(monthNumber).toHaveText(before);
});

test("めくっている間も、ガラスの面(表の外枠)は動かない。#3", async ({ page }) => {
  const viewport = page.getByTestId("month-flip-viewport");
  const box = (await viewport.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await viewport.dispatchEvent("touchstart", { touches: [{ identifier: 1, clientX: x, clientY: y }] });
  await viewport.dispatchEvent("touchmove", { touches: [{ identifier: 1, clientX: x - 150, clientY: y }] });

  const transform = await page.getByRole("region", { name: "月の表" }).evaluate((el) => getComputedStyle(el).transform);
  expect(transform).toBe("none");

  await viewport.dispatchEvent("touchend", {
    touches: [],
    changedTouches: [{ identifier: 1, clientX: x - 150, clientY: y }],
  });
});

test("ラボで「横に滑るだけ」を選んでも、スワイプで月は移る", async ({ page }) => {
  await page.goto("/settings");
  const lab = page.getByRole("region", { name: "ラボ" });
  await lab.getByRole("switch", { name: "月送り: 横に滑るだけ" }).click();
  await page.goto("/");

  const monthNumber = page.getByTestId("month-number");
  const before = Number(await monthNumber.innerText());
  await swipeHorizontal(page.getByTestId("month-flip-viewport"), -220);
  await expect(monthNumber).toHaveText(((before % 12) + 1).toString());
});

test("動きを減らす設定では、追従を見せずに月だけ移る", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();

  const monthNumber = page.getByTestId("month-number");
  const before = Number(await monthNumber.innerText());
  await swipeHorizontal(page.getByTestId("month-flip-viewport"), -220);
  await expect(monthNumber).toHaveText(((before % 12) + 1).toString());

  // 複製(めくる面)は一度も挿さらない
  const topLayers = await page.getByTestId("month-flip-viewport").locator("> div[aria-hidden='true']").count();
  expect(topLayers).toBe(0);
});

test("表示を切り替えると、View Transitions を使って動く", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __vtCalls: number }).__vtCalls = 0;
    const proto = Document.prototype as unknown as {
      startViewTransition?: (cb: () => void) => unknown;
    };
    const orig = proto.startViewTransition;
    if (orig) {
      proto.startViewTransition = function (this: Document, cb: () => void) {
        (window as unknown as { __vtCalls: number }).__vtCalls++;
        return orig.call(this, cb);
      };
    }
  });
  await page.reload();

  await page.getByRole("radio", { name: "日" }).last().click();
  await expect(page.getByRole("region", { name: "日の予定" })).toBeVisible();

  const calls = await page.evaluate(() => (window as unknown as { __vtCalls?: number }).__vtCalls ?? 0);
  expect(calls).toBeGreaterThan(0);

  // 選んでいる日の名前は、常に画面に 1 つだけ
  const named = await page.evaluate(() => document.querySelectorAll('[style*="view-transition-name"]').length);
  expect(named).toBe(1);
});

test("動きを減らす設定では、View Transitions を使わず切り替わるだけ", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    (window as unknown as { __vtCalls: number }).__vtCalls = 0;
    const proto = Document.prototype as unknown as {
      startViewTransition?: (cb: () => void) => unknown;
    };
    const orig = proto.startViewTransition;
    if (orig) {
      proto.startViewTransition = function (this: Document, cb: () => void) {
        (window as unknown as { __vtCalls: number }).__vtCalls++;
        return orig.call(this, cb);
      };
    }
  });
  await page.reload();

  await page.getByRole("radio", { name: "週" }).last().click();
  await expect(page.getByRole("region", { name: "週の予定" })).toBeVisible();

  const calls = await page.evaluate(() => (window as unknown as { __vtCalls?: number }).__vtCalls ?? 0);
  expect(calls).toBe(0);
});
