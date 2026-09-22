import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

/**
 * スマホの幅で、画面が崩れないことを見る。
 * 前は、10 月のように 2 桁の月で上の帯が横にあふれ、「今日」が 2 行になり、
 * アカウントの丸が画面の外に出ていた。シートは透けて、後ろのカレンダーが文字に重なっていた。
 */

/** その要素と中身が、画面の幅に収まっているか */
async function fitsInScreen(page: import("@playwright/test").Page, selector: string) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel)!;
    const width = window.innerWidth;
    const over: string[] = [];
    for (const el of [root, ...root.querySelectorAll("*")]) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > width + 1 || r.left < -1) over.push(`${el.tagName}:${(el.textContent ?? "").trim().slice(0, 10)}`);
    }
    return over;
  }, selector);
}

/** その要素の文字が、何行に折り返されているか */
async function lineCount(locator: import("@playwright/test").Locator) {
  return locator.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getClientRects().length;
  });
}

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("2 桁の月でも、上の帯は画面に収まり、「今日」は 1 行のまま", async ({ page }) => {
  // 今日から離れると「今日」のボタンが増え、上の帯がいちばん混む。0012
  await page.getByRole("button", { name: "次の月" }).click();
  const todayButton = page.getByRole("button", { name: "今日", exact: true });
  await expect(todayButton).toBeVisible();
  expect(await lineCount(todayButton)).toBe(1);
  expect(await fitsInScreen(page, "header")).toEqual([]);
  await expect(page.getByRole("button", { name: "カレンダーを読み直す" })).toBeInViewport();
  await expect(page.getByRole("button", { name: "アカウントのメニュー" })).toBeInViewport();
});

test("下の操作の帯も、画面に収まる", async ({ page }) => {
  expect(await fitsInScreen(page, '[role="toolbar"]')).toEqual([]);
  await expect(page.getByRole("button", { name: "予定を足す" })).toBeInViewport();
});

test("シートは透けない。後ろのカレンダーが文字に重ならない", async ({ page }) => {
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  await expect(page.getByRole("dialog", { name: "新しい予定" })).toBeVisible();
  const opaque = await page.locator('[data-slot="sheet-content"]').evaluate((el) => {
    const alpha = getComputedStyle(el).backgroundColor.match(/rgba?\([^)]*?([\d.]+)\)$/);
    // rgb(...) なら不透明。rgba(...) なら 4 つ目の値が 1 のときだけ不透明
    return !getComputedStyle(el).backgroundColor.startsWith("rgba") || Number(alpha?.[1]) === 1;
  });
  expect(opaque).toBe(true);
});

test("日本語は、語の途中で折り返さない", async ({ page }) => {
  const value = await page.evaluate(() => getComputedStyle(document.body).wordBreak);
  expect(value).toBe("auto-phrase");
});
