import { expect, type Page, test } from "@playwright/test";
import { addExtension, addMemories, dayPanel, signUp } from "./helpers";

/** 日本時間の今日から、指定した日数だけ進んだ日を `yyyy-mm-dd` で返す */
function tokyoDateKey(offsetDays: number): string {
  const at = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(at);
}

/**
 * 設定の「天気」で、市区町村を検索して最初の候補を選ぶ。
 * 手元の開発と E2E では、Open-Meteo の代わりに Worker 自身の見本の応答を読む。
 */
async function pickPlace(page: Page, query: string) {
  await page.goto("/settings/extensions/weather");
  const section = page.getByRole("region", { name: "天気" });
  await section.getByRole("button", { name: /場所を(選ぶ|変える)/ }).click();
  const sheet = page.getByRole("dialog", { name: "場所を選ぶ" });
  await sheet.getByLabel("市区町村の名前で探す").fill(query);
  const result = sheet.getByRole("listitem").first();
  await expect(result).toBeVisible();
  await result.getByRole("button").click();
  await expect(sheet).toBeHidden();
  return section;
}

test("いつもの場所を選ぶと、7 日分の天気がカレンダーに出る。押すと出どころとともに見られる。消すと消える。F-401〜F-405、F-409", async ({
  page,
}) => {
  await signUp(page, { name: "こた" });
  const section = await pickPlace(page, "渋谷");
  await expect(page.getByText("渋谷区 をいつもの場所にしました")).toBeVisible();
  await expect(section.getByText("渋谷区")).toBeVisible();

  // 今日の天気の見本は「晴れ 24°/18°」。カレンダーの今日のマスに小さく出る。F-403
  await page.goto("/");
  const badge = dayPanel(page).getByRole("button", { name: "晴れ 24°/18°" });
  await expect(badge).toBeVisible();

  // 押すと、読むだけのシートで説明、場所、出どころの表示が出る。F-404、F-405
  await badge.click();
  const sheet = page.getByRole("dialog", { name: "晴れ 24°/18°" });
  await expect(sheet).toContainText("いつもの場所の天気です。");
  await expect(sheet).toContainText("渋谷区");
  await expect(sheet).toContainText("気象データ: Open-Meteo.com");
  await expect(sheet.getByRole("button", { name: /消す|保存/ })).toHaveCount(0);
  // 「閉じる」のボタンは、下の明示のボタンと、右上の X の読み上げ名がどちらも「閉じる」なので先頭を取る
  await sheet.getByRole("button", { name: "閉じる" }).first().click();

  // いつもの場所を消すと、天気はカレンダーから出なくなる。F-402、F-409
  await page.goto("/settings/extensions/weather");
  await section.getByRole("button", { name: "消す" }).click();
  await page.getByRole("dialog", { name: "渋谷区 を消す" }).getByRole("button", { name: "消す" }).click();
  await expect(page.getByText("いつもの場所を消しました")).toBeVisible();

  await page.goto("/");
  await expect(dayPanel(page).getByRole("button", { name: "晴れ 24°/18°" })).toHaveCount(0);
});

test("しおりの過去の日に、その日の天気が自動で残る。F-406、F-407", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await pickPlace(page, "渋谷");
  await expect(page.getByText("渋谷区 をいつもの場所にしました")).toBeVisible();

  await addExtension(page, "思い出");

  // 昨日だけの日帰りの思い出を作る。しおりの 1 日は、その日の過去の天気を Open-Meteo から 1 度だけ取る
  await page.goto("/memories");
  await addMemories(page, "思い出を作る");
  const create = page.getByRole("dialog", { name: "思い出を作る" });
  await create.getByLabel("題名").fill("渋谷 日帰り");
  await create.getByLabel("始まりの日").fill(tokyoDateKey(-1));
  await create.getByRole("button", { name: "作る" }).click();
  await expect(page).toHaveURL(/\/days\/0$/);

  // 見本の過去の天気は「雨 22°/18°」。今日の予報(晴れ 24°/18°)とは違う値にして、見分けが付くようにしている
  await expect(page.getByText("雨 22°/18°")).toBeVisible();
});
