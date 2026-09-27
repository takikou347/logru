import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { addEvent, addExtension, logOut, signUp } from "./helpers";

/**
 * 主な画面を axe-core で検査する。決定 0034 の読みやすさを、毎回の CI で壊していないか見る。issue #96
 *
 * 重大(critical)と深刻(serious)は落とす。中程度(moderate)と軽微(minor)は一覧に出すだけで落とさない。
 * 見つかったものは別の issue に自動で立てる運用にする(0038)。ここでは重大なものだけを守る。
 */

/** critical・serious のときだけ落とす。moderate・minor は名前だけコンソールに出す */
async function checkA11y(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const severe = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  const minor = results.violations.filter((v) => v.impact !== "critical" && v.impact !== "serious");
  if (minor.length > 0) {
    console.log(`[a11y] ${label}: 中程度・軽微 ${minor.length} 件 (${minor.map((v) => v.id).join("、")})`);
  }
  const detail = severe.map((v) => `${v.id}(${v.impact}): ${v.help} - ${v.nodes.length} 件\n  ${v.helpUrl}`).join("\n");
  expect(severe, `${label} の重大な違反:\n${detail}`).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("ログインの画面に重大な違反が無い", async ({ page }) => {
  await logOut(page);
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
  await checkA11y(page, "ログイン");
});

test("カレンダーの画面に重大な違反が無い", async ({ page }) => {
  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();
  await checkA11y(page, "カレンダー");
});

test("予定のシートに重大な違反が無い", async ({ page }) => {
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  await expect(page.getByRole("dialog", { name: "新しい予定" })).toBeVisible();
  await checkA11y(page, "予定のシート");
});

test("設定の各節に重大な違反が無い", async ({ page }) => {
  for (const [path, title] of [
    ["/settings/appearance", "見た目"],
    ["/settings/notifications", "通知"],
    ["/settings/extensions", "機能"],
    ["/settings/usage", "使い方"],
    ["/settings/account", "アカウント"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
    await checkA11y(page, `設定・${title}`);
  }
});

test("グループの詳しい画面に重大な違反が無い", async ({ page }) => {
  await page.goto("/groups");
  await page.getByLabel("グループの名前").fill("テスト");
  await page.getByRole("button", { name: "作る" }).click();
  await expect(page.getByRole("heading", { name: "テスト", level: 1 })).toBeVisible();
  await checkA11y(page, "グループの詳しい画面");
});

test("機能を足す画面に重大な違反が無い", async ({ page }) => {
  await page.goto("/settings/extensions/add");
  await expect(page.getByRole("heading", { name: "機能を足す", level: 1 })).toBeVisible();
  await checkA11y(page, "機能を足す");
});

test("思い出の画面に重大な違反が無い", async ({ page }) => {
  await addExtension(page, "思い出");
  await page.goto("/memories");
  await expect(page.getByRole("heading", { name: "思い出", level: 1 })).toBeVisible();
  await checkA11y(page, "思い出");
});

test("家計簿の画面に重大な違反が無い", async ({ page }) => {
  await addExtension(page, "家計簿");
  await page.goto("/kakeibo");
  await expect(page.getByRole("heading", { name: "家計簿", level: 1 })).toBeVisible();
  await checkA11y(page, "家計簿");
});

test("共有リストの画面に重大な違反が無い", async ({ page }) => {
  await addExtension(page, "リスト");
  await page.goto("/lists");
  await expect(page.getByRole("heading", { name: "リスト", level: 1 })).toBeVisible();
  await checkA11y(page, "共有リスト");
});

test("1 年のらせんの画面に重大な違反が無い", async ({ page }) => {
  await addEvent(page, "歯医者");
  await page.getByRole("link", { name: /年を、らせんで見る/ }).click();
  await expect(page).toHaveURL(/\/spiral\//);
  await checkA11y(page, "1 年のらせん");
});
