import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

/** 機能の一覧で、思い出を自分だけで使えるようにする */
async function enableMemories(page: import("@playwright/test").Page) {
  await page.goto("/extensions");
  const toggle = page.getByRole("switch", { name: "思い出を使う" });
  await toggle.click();
  await expect(toggle).toBeChecked();
}

/** 日本時間の今日から、指定した日数だけ進んだ日を `yyyy-mm-dd` で返す */
function tokyoDateKey(offsetDays: number): string {
  const at = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(at);
}

test("思い出の表紙を押すと本の演出の後に開く。動きを減らす設定ではすぐに開く。0050、#103", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableMemories(page);
  await page.goto("/memories");
  await page.getByRole("button", { name: "思い出を作る" }).click();
  const create = page.getByRole("dialog", { name: "思い出を作る" });
  await create.getByLabel("題名").fill("那須 日帰り");
  await create.getByRole("button", { name: "作る" }).click();
  await expect(page).toHaveURL(/\/days\/0$/);

  // 一覧の表紙を押すと、本の演出をしてから開く
  await page.goto("/memories");
  const cover = page.getByRole("link", { name: /那須 日帰り/ });
  await expect(cover).toBeVisible();
  await cover.click();
  await expect(page).toHaveURL(/\/memories\/[^/]+\/days\/0$/);

  // 動きを減らす設定では、演出をせずすぐに開く
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/memories");
  const coverAgain = page.getByRole("link", { name: /那須 日帰り/ });
  await coverAgain.click();
  await expect(page).toHaveURL(/\/memories\/[^/]+\/days\/0$/, { timeout: 1_000 });
});

test("しおりの 1 日を、横に指でめくって隣の日へ移れる。0050、#103", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableMemories(page);
  await page.goto("/memories");
  await page.getByRole("button", { name: "思い出を作る" }).click();
  const create = page.getByRole("dialog", { name: "思い出を作る" });
  await create.getByLabel("題名").fill("那須 2 泊");
  await create.getByLabel("終わりの日").fill(tokyoDateKey(2));
  await create.getByRole("button", { name: "作る" }).click();
  await expect(page).toHaveURL(/\/days\/0$/);

  const empty = page.getByText("この日の記録はまだありません。「記録する」から写真や文章を追加できます。");
  await expect(empty).toBeVisible();
  const box = await empty.boundingBox();
  if (!box) throw new Error("1 日の面が見つからない");
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.85, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.1, y, { steps: 12 });
  await page.mouse.up();
  await expect(page).toHaveURL(/\/days\/1$/);

  // 動きを減らす設定では、指でなぞっても隣の日へ移らない
  await page.emulateMedia({ reducedMotion: "reduce" });
  const empty2 = page.getByText("この日の記録はまだありません。「記録する」から写真や文章を追加できます。");
  await expect(empty2).toBeVisible();
  const box2 = await empty2.boundingBox();
  if (!box2) throw new Error("1 日の面が見つからない");
  const y2 = box2.y + box2.height / 2;
  await page.mouse.move(box2.x + box2.width * 0.85, y2);
  await page.mouse.down();
  await page.mouse.move(box2.x + box2.width * 0.1, y2, { steps: 12 });
  await page.mouse.up();
  await expect(page).toHaveURL(/\/days\/1$/);
});
