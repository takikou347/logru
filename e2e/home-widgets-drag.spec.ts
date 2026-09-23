import { expect, test } from "@playwright/test";
import { signUp, touchDrag } from "./helpers";

// スマホの幅。0029、#121
test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("スマホで、持ち手を指で引いてウィジェットを並べ替え、保存すると読み直しても残る。#121", async ({ page }) => {
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

  // 「このあと」の持ち手を指で押して、カレンダーの本体の上まで引く
  await touchDrag(
    page,
    { x: from.x + from.width / 2, y: from.y + from.height / 2 },
    { x: to.x + to.width / 2, y: to.y + 8 },
  );

  await expect(frames.nth(0)).toHaveAttribute("data-widget-key", "home.upcoming");
  await expect(frames.nth(1)).toHaveAttribute("data-widget-key", "home.calendar");

  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("ホームを保存しました")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "ホームを編集" }).click();
  await expect(frames.nth(0)).toHaveAttribute("data-widget-key", "home.upcoming");
});
