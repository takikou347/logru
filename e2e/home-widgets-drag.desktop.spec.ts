import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("PC で、持ち手をマウスで引いてウィジェットを並べ替え、保存すると読み直しても残る。#121", async ({ page }) => {
  await page.getByRole("button", { name: "ホームを編集" }).click();

  const grid = page.getByTestId("widget-grid");
  const frames = grid.getByTestId("widget-frame");
  await expect(frames).toHaveCount(3);
  await expect(frames.nth(0)).toHaveAttribute("data-widget-key", "home.calendar");
  await expect(frames.nth(2)).toHaveAttribute("data-widget-key", "home.upcoming");

  const upcomingHandle = grid.locator('[data-widget-key="home.upcoming"]').getByTestId("widget-handle");
  const calendarFrame = grid.locator('[data-widget-key="home.calendar"]');

  // 持ち手を画面内に収めてから位置を測る。boundingBox は画面外でも値を返すので、押す前に自分でスクロールする
  await upcomingHandle.scrollIntoViewIfNeeded();
  const from = await upcomingHandle.boundingBox();
  const to = await calendarFrame.boundingBox();
  if (!from || !to) throw new Error("枠の位置が取れなかった");

  // 「このあと」の持ち手をマウスで押して、カレンダーの本体の上まで引く
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  const steps = 8;
  const targetX = to.x + to.width / 2;
  const targetY = to.y + 8;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      from.x + from.width / 2 + ((targetX - (from.x + from.width / 2)) * i) / steps,
      from.y + from.height / 2 + ((targetY - (from.y + from.height / 2)) * i) / steps,
    );
  }
  await page.mouse.up();

  await expect(frames.nth(0)).toHaveAttribute("data-widget-key", "home.upcoming");
  await expect(frames.nth(1)).toHaveAttribute("data-widget-key", "home.calendar");

  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("ホームを保存しました")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "ホームを編集" }).click();
  await expect(frames.nth(0)).toHaveAttribute("data-widget-key", "home.upcoming");
});
