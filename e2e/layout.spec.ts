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

test("上の帯の高さは、月が 1 桁でも 2 桁でも、「今日」が出ても変わらない", async ({ page }) => {
  // 月を移るたびに帯の高さが変わると落ち着かない。スマホではいつも月と年の下へ操作を置く
  const header = page.locator("header");
  const height = async () => (await header.boundingBox())!.height;
  const before = await height();
  await page.getByRole("button", { name: "次の月" }).click();
  await expect(page.getByRole("button", { name: "今日", exact: true })).toBeVisible();
  expect(await height()).toBe(before);
});

test("下の操作の帯は折り返さない", async ({ page }) => {
  const wrapped = await page.locator('[role="toolbar"]').evaluate((el) => {
    const tallest = Math.max(...[...el.children].map((c) => c.getBoundingClientRect().height));
    // p-1.5 の上下 12 px ぶんを見込む
    return el.getBoundingClientRect().height > tallest + 14;
  });
  expect(wrapped).toBe(false);
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
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await expect(sheet).toBeVisible();
  // 位置と大きさだけを持つ [data-slot="sheet-content"] は透明にし、開閉の動きを付ける。0077
  // 塗りを持つのは、そのすぐ内側のガラスの面(.glass)
  const opaque = await sheet
    .locator(".glass")
    .first()
    .evaluate((el) => {
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
