import { expect, test } from "@playwright/test";
import { enableNewLook, signUp } from "./helpers";

/**
 * 刷新 2。骨組み(上の帯、週の帯、下のタブ、「+」の放射)とアイコンだけの操作。0091、issue #239
 *
 * ラボの「新しい見た目」を入れた人だけに出る。入れていない人の画面は今までのまま(下のタブの
 * 帯は出ず、今までの Dock がそのまま動く)。
 */

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("新しい見た目を入れていない人には、下のタブの帯が出ない", async ({ page }) => {
  await expect(page.getByRole("navigation", { name: "下のタブ" })).toBeHidden();
  // 今までの Dock(カレンダーの操作)はそのまま動く
  await expect(page.getByRole("toolbar", { name: "カレンダーの操作" })).toBeVisible();
});

test("新しい見た目を入れると、下のタブが 5 つアイコンだけで並ぶ。読み上げの名前は残る", async ({ page }) => {
  await enableNewLook(page);
  // 4 回目以降を装う。はじめの 3 回の名前を消してから、アイコンだけの見た目を確かめる
  await page.evaluate(() => localStorage.setItem("logru:new-look-tab-hints-seen", "3"));
  await page.goto("/");

  const tabs = page.getByRole("navigation", { name: "下のタブ" });
  await expect(tabs).toBeVisible();
  // 今までの Dock は隠れる。役目を下のタブの帯が引き継ぐ。issue #239
  await expect(page.getByRole("toolbar", { name: "カレンダーの操作" })).toBeHidden();

  await expect(tabs.getByRole("link", { name: "今日のページ" })).toBeVisible();
  await expect(tabs.getByRole("link", { name: "カレンダー" })).toBeVisible();
  await expect(tabs.getByRole("button", { name: "記録する" })).toBeVisible();
  await expect(tabs.getByRole("link", { name: "機能" })).toBeVisible();
  await expect(tabs.getByRole("link", { name: "設定" })).toBeVisible();

  // アイコンだけ。名前を常に出す文字(はじめの 3 回の注記)は無い
  await expect(tabs.getByTestId("tab-hint")).toHaveCount(0);
});

test("はじめの 3 回だけ、タブの下に名前が出る", async ({ page }) => {
  await enableNewLook(page);
  await page.goto("/");
  const tabs = page.getByRole("navigation", { name: "下のタブ" });
  await expect(tabs.getByTestId("tab-hint")).toHaveCount(5);

  // 4 回目からは消える
  await page.evaluate(() => localStorage.setItem("logru:new-look-tab-hints-seen", "3"));
  await page.reload();
  await expect(tabs.getByTestId("tab-hint")).toHaveCount(0);
});

test("長押しで名前が出て、離しても操作はしない", async ({ page }) => {
  await enableNewLook(page);
  await page.evaluate(() => localStorage.setItem("logru:new-look-tab-hints-seen", "3"));
  await page.goto("/");

  const tabs = page.getByRole("navigation", { name: "下のタブ" });
  const settingsTab = tabs.getByRole("link", { name: "設定" });
  const box = await settingsTab.boundingBox();
  if (!box) throw new Error("設定タブが見つかりません");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(tabs.getByTestId("long-press-label")).toHaveText("設定");
  await page.mouse.up();

  // 長押しから離しただけなので、設定には移らない
  await expect(page).toHaveURL("/");
  await expect(tabs.getByTestId("long-press-label")).toHaveCount(0);
});

test("「機能」「設定」タブで、それぞれの画面へ移る", async ({ page }) => {
  await enableNewLook(page);
  const tabs = page.getByRole("navigation", { name: "下のタブ" });
  await tabs.getByRole("link", { name: "機能" }).click();
  await expect(page).toHaveURL("/settings/extensions");

  await page.goto("/");
  await tabs.getByRole("link", { name: "設定" }).click();
  await expect(page).toHaveURL("/settings");
});

test("「+」は、いま開いている画面の足せるものをそのまま開く(予定を足す)", async ({ page }) => {
  await enableNewLook(page);
  await page.goto("/");
  const tabs = page.getByRole("navigation", { name: "下のタブ" });
  await tabs.getByRole("button", { name: "記録する" }).click();
  await expect(page.getByRole("dialog", { name: "新しい予定" })).toBeVisible();
});

test("設定の画面など、足せるものが無い画面では「+」が出ない", async ({ page }) => {
  await enableNewLook(page);
  await page.goto("/settings");
  const tabs = page.getByRole("navigation", { name: "下のタブ" });
  await expect(tabs.getByRole("button", { name: "記録する" })).toHaveCount(0);
});

test("PC(1024px 以上)では、新しい見た目でも下のタブの帯が出ない", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await enableNewLook(page);
  await expect(page.getByRole("navigation", { name: "下のタブ" })).toBeHidden();
});
