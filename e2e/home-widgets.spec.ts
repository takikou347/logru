import { expect, type Page, test } from "@playwright/test";
import { addEvent, dayPanel, signUp } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

/** 機能の一覧で、思い出を使うかを切り替える */
async function setMemories(page: Page, on: boolean) {
  await page.goto("/settings/extensions");
  const toggle = page.getByRole("switch", { name: "思い出を使う" });
  if ((await toggle.isChecked()) !== on) await toggle.click();
  await expect(toggle).toBeChecked({ checked: on });
}

test("ホームを編集して並べ替え、外す。保存すると読み直しても同じで、最初の並びに戻せる。#49、#76", async ({ page }) => {
  await addEvent(page, "歯医者");
  await expect(dayPanel(page).getByRole("button", { name: /歯医者/ })).toBeVisible();

  await page.getByRole("button", { name: "ホームを編集" }).click();
  // 編集の間は、上の帯の代わりに編集の帯を出す。取り消しは 1 か所だけ。#76
  const bar = page.getByTestId("home-edit-bar");
  await expect(bar.getByRole("heading", { name: "ホームを編集" })).toBeVisible();
  await expect(page.getByRole("button", { name: "取り消し" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "次の月" })).toHaveCount(0);

  const grid = page.getByTestId("widget-grid");
  const frames = grid.getByTestId("widget-frame");
  // 拡張を何も使っていない、初めてのホームは土台の 3 つだけ
  await expect(frames).toHaveCount(3);
  await expect(frames.nth(0)).toHaveAttribute("data-widget-key", "home.calendar");
  // 大きさは選ばせない。#76
  await expect(grid.getByRole("radio")).toHaveCount(0);

  // 「このあと」を上へ動かし、カレンダーの本体の前に出す
  const upcomingFrame = grid.locator('[data-widget-key="home.upcoming"]');
  await upcomingFrame.getByRole("button", { name: "このあとを上へ" }).click();
  await upcomingFrame.getByRole("button", { name: "このあとを上へ" }).click();
  await expect(frames.nth(0)).toHaveAttribute("data-widget-key", "home.upcoming");

  // カレンダーの本体は外せない
  const calendarFrame = grid.locator('[data-widget-key="home.calendar"]');
  await expect(calendarFrame.getByRole("button", { name: "カレンダーを外す" })).toHaveCount(0);

  // 「選んだ日の予定」を外す
  await grid
    .locator('[data-widget-key="home.day-panel"]')
    .getByRole("button", { name: "選んだ日の予定を外す" })
    .click();
  await expect(frames).toHaveCount(2);

  await bar.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("ホームを保存しました")).toBeVisible();
  await expect(bar).toHaveCount(0);

  // 外したので、選んだ日の予定はもう出ない
  await expect(dayPanel(page)).toHaveCount(0);

  // 読み直しても同じ並びのまま
  await page.reload();
  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();
  await expect(dayPanel(page)).toHaveCount(0);
  await page.getByRole("button", { name: "ホームを編集" }).click();
  const framesAfterReload = grid.getByTestId("widget-frame");
  await expect(framesAfterReload).toHaveCount(2);
  await expect(framesAfterReload.nth(0)).toHaveAttribute("data-widget-key", "home.upcoming");

  // 取り消すと、直したものは残らない
  await grid.locator('[data-widget-key="home.upcoming"]').getByRole("button", { name: "このあとを下へ" }).click();
  await expect(framesAfterReload.nth(0)).toHaveAttribute("data-widget-key", "home.calendar");
  await page.getByRole("button", { name: "取り消し" }).click();
  await page.getByRole("button", { name: "ホームを編集" }).click();
  await expect(framesAfterReload.nth(0)).toHaveAttribute("data-widget-key", "home.upcoming");

  // 最初の並びに戻す
  await page.getByRole("button", { name: "最初の並びに戻す" }).click();
  await expect(framesAfterReload).toHaveCount(3);
  await expect(framesAfterReload.nth(0)).toHaveAttribute("data-widget-key", "home.calendar");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("ホームを保存しました")).toBeVisible();
  await expect(dayPanel(page)).toBeVisible();
});

test("思い出を使うと、ホームに「ひとコマ」と「記録する」が最初から並び、1 回押すだけで開く。#78", async ({ page }) => {
  await setMemories(page, true);
  await page.goto("/");
  const grid = page.getByTestId("widget-grid");
  const koma = grid.getByTestId("widget-koma");
  const record = grid.getByTestId("widget-record");
  await expect(koma).toBeVisible();
  await expect(record).toBeVisible();
  // 前の「思い出の近道」の文言は出ない。#77
  await expect(page.getByText("いま押してほしい近道はありません。")).toHaveCount(0);

  await koma.click();
  await expect(page).toHaveURL(/\/memories\/koma$/);

  await page.goto("/");
  await grid.getByTestId("widget-record").click();
  await expect(page.getByRole("dialog", { name: "記録する" })).toBeVisible();

  // ほかのウィジェットと同じ操作で並べ替えられる。外して「ウィジェットを足す」から戻せる
  await page.goto("/");
  await page.getByRole("button", { name: "ホームを編集" }).click();
  const frames = grid.getByTestId("widget-frame");
  await expect(frames).toHaveCount(5);
  await expect(frames.nth(3)).toHaveAttribute("data-widget-key", "memories.koma");
  await expect(frames.nth(4)).toHaveAttribute("data-widget-key", "memories.record");
  await grid.locator('[data-widget-key="memories.record"]').getByRole("button", { name: "記録するを上へ" }).click();
  await expect(frames.nth(3)).toHaveAttribute("data-widget-key", "memories.record");
  await grid.locator('[data-widget-key="memories.koma"]').getByRole("button", { name: "ひとコマを外す" }).click();
  await expect(frames).toHaveCount(4);
  await page.getByRole("button", { name: "ウィジェットを足す" }).click();
  await page
    .getByRole("dialog", { name: "ウィジェットを足す" })
    .getByRole("button", { name: /ひとコマ/ })
    .click();
  await expect(frames).toHaveCount(5);
  await expect(frames.nth(4)).toHaveAttribute("data-widget-key", "memories.koma");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("ホームを保存しました")).toBeVisible();

  // 思い出を使わないと、2 つはホームから消える。使い直すと、元の場所に戻る
  await setMemories(page, false);
  await page.goto("/");
  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();
  await expect(grid.getByTestId("widget-koma")).toHaveCount(0);
  await expect(grid.getByTestId("widget-record")).toHaveCount(0);

  await setMemories(page, true);
  await page.goto("/");
  await expect(grid.getByTestId("widget-koma")).toBeVisible();
  await page.getByRole("button", { name: "ホームを編集" }).click();
  await expect(frames.nth(3)).toHaveAttribute("data-widget-key", "memories.record");
  await expect(frames.nth(4)).toHaveAttribute("data-widget-key", "memories.koma");
});
