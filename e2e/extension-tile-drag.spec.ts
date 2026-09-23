import { expect, test } from "@playwright/test";
import { addExtension, signUp, touchDrag } from "./helpers";

// スマホの幅。0029、#121、issue #145
test.use({ viewport: { width: 390, height: 844 } });

test("スマホで、機能のタイルを指で引いて並べ替えると、読み直しても残る。issue #145、#121", async ({ page }) => {
  await signUp(page);
  await addExtension(page, "家計簿");
  await addExtension(page, "思い出");

  await page.goto("/settings/extensions");
  const grid = page.getByTestId("extension-tile-grid");
  const tiles = grid.locator('[data-testid^="extension-tile-"]');
  // いつも足された「外部のカレンダー」が先頭。並びをまだ保存していないので、拡張の一覧の順(思い出、家計簿)で並ぶ
  await expect(tiles.nth(0)).toHaveAttribute("data-testid", "extension-tile-external");
  await expect(tiles.nth(1)).toHaveAttribute("data-testid", "extension-tile-memories");
  await expect(tiles.nth(2)).toHaveAttribute("data-testid", "extension-tile-kakeibo");

  await page.getByRole("button", { name: "並びを変える" }).click();

  const memoriesHandle = grid.locator('[data-testid="extension-tile-memories"]').getByTestId("tile-drag-handle");
  const kakeiboTile = grid.locator('[data-testid="extension-tile-kakeibo"]');

  await memoriesHandle.scrollIntoViewIfNeeded();
  const from = await memoriesHandle.boundingBox();
  const to = await kakeiboTile.boundingBox();
  if (!from || !to) throw new Error("タイルの位置が取れなかった");

  // 「思い出」の持ち手を指で押して、「家計簿」の上まで引く。並び替えは押した瞬間に保存する
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/me/extension-order") && r.request().method() === "PUT"),
    touchDrag(
      page,
      { x: from.x + from.width / 2, y: from.y + from.height / 2 },
      { x: to.x + to.width / 2, y: to.y + to.height / 2 },
    ),
  ]);
  expect(resp.ok()).toBe(true);

  await expect(tiles.nth(1)).toHaveAttribute("data-testid", "extension-tile-kakeibo");
  await expect(tiles.nth(2)).toHaveAttribute("data-testid", "extension-tile-memories");

  await page.getByRole("button", { name: "完了" }).click();
  await page.reload();
  const reloadedTiles = page.getByTestId("extension-tile-grid").locator('[data-testid^="extension-tile-"]');
  await expect(reloadedTiles.nth(1)).toHaveAttribute("data-testid", "extension-tile-kakeibo");
  await expect(reloadedTiles.nth(2)).toHaveAttribute("data-testid", "extension-tile-memories");
});
