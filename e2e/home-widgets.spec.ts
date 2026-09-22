import { expect, test } from "@playwright/test";
import { addEvent, dayPanel, signUp } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("ホームを編集して並べ替え、大きさを変え、外す。保存すると読み直しても同じで、最初の並びに戻せる。#49", async ({
  page,
}) => {
  await addEvent(page, "歯医者");
  await expect(dayPanel(page).getByRole("button", { name: /歯医者/ })).toBeVisible();

  await page.getByRole("button", { name: "ホームを編集" }).click();
  const grid = page.getByTestId("widget-grid");
  const frames = grid.getByTestId("widget-frame");
  // 拡張を何も使っていない、初めてのホームは土台の 3 つだけ
  await expect(frames).toHaveCount(3);
  await expect(frames.nth(0)).toHaveAttribute("data-widget-key", "home.calendar");

  // 「このあと」を上へ動かし、カレンダーの本体の前に出す
  const upcomingFrame = grid.locator('[data-widget-key="home.upcoming"]');
  await upcomingFrame.getByRole("button", { name: "このあとを上へ" }).click();
  await upcomingFrame.getByRole("button", { name: "このあとを上へ" }).click();
  await expect(frames.nth(0)).toHaveAttribute("data-widget-key", "home.upcoming");

  // カレンダーの本体の大きさを「小」に変える
  const calendarFrame = grid.locator('[data-widget-key="home.calendar"]');
  await calendarFrame.getByRole("radio", { name: "小" }).click();
  await expect(calendarFrame.getByRole("radio", { name: "小" })).toHaveAttribute("aria-checked", "true");
  // カレンダーの本体は外せない
  await expect(calendarFrame.getByRole("button", { name: "カレンダーを外す" })).toHaveCount(0);

  // 「選んだ日の予定」を外す
  await grid
    .locator('[data-widget-key="home.day-panel"]')
    .getByRole("button", { name: "選んだ日の予定を外す" })
    .click();
  await expect(frames).toHaveCount(2);

  await page.getByRole("button", { name: "完了" }).click();
  await expect(page.getByText("ホームを保存しました")).toBeVisible();

  // 外したので、選んだ日の予定はもう出ない
  await expect(dayPanel(page)).toHaveCount(0);

  // 読み直しても同じ並びと大きさのまま
  await page.reload();
  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();
  await expect(dayPanel(page)).toHaveCount(0);
  await page.getByRole("button", { name: "ホームを編集" }).click();
  const framesAfterReload = grid.getByTestId("widget-frame");
  await expect(framesAfterReload).toHaveCount(2);
  await expect(framesAfterReload.nth(0)).toHaveAttribute("data-widget-key", "home.upcoming");
  await expect(grid.locator('[data-widget-key="home.calendar"]').getByRole("radio", { name: "小" })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  // 最初の並びに戻す
  await page.getByRole("button", { name: "最初の並びに戻す" }).click();
  await expect(framesAfterReload).toHaveCount(3);
  await expect(framesAfterReload.nth(0)).toHaveAttribute("data-widget-key", "home.calendar");
  await expect(grid.locator('[data-widget-key="home.calendar"]').getByRole("radio", { name: "大" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("button", { name: "完了" }).click();
  await expect(page.getByText("ホームを保存しました")).toBeVisible();
  await expect(dayPanel(page)).toBeVisible();
});
