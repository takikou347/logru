import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

/**
 * 機能の一覧はアイコンのタイルで並べ、拡張ごとの詳細に「自分で使う」「使うグループ」「その拡張の設定」を集める。
 * issue #102、issue #145、0058
 * 決まり: 拡張の設定は、その拡張の詳細に置く。トグルではなく「足す」「外す」のボタンにする。
 */

test("タイルの並びには、いつも足された拡張が先頭に出る。まだ足していない拡張のタイルは出ない", async ({ page }) => {
  await signUp(page);
  await page.goto("/settings/extensions");
  const grid = page.getByTestId("extension-tile-grid");
  await expect(grid.getByTestId("extension-tile-external")).toBeVisible();
  await expect(grid.getByTestId("extension-tile-memories")).toHaveCount(0);
  await expect(grid.getByRole("link", { name: "機能を足す" })).toBeVisible();
});

test("拡張の詳細で自分で使うを切り替えられる。足すとタイルの並びに出て、外すとまた消える", async ({ page }) => {
  await signUp(page);
  await page.goto("/settings/extensions/memories");
  await expect(page.getByRole("heading", { name: "思い出", level: 1 })).toBeVisible();

  const own = page.getByRole("region", { name: "自分で使う" });
  const addButton = own.getByRole("button", { name: "思い出を足す" });
  await addButton.click();
  await expect(page.getByText("足しました")).toBeVisible();
  const removeButton = own.getByRole("button", { name: "思い出を外す" });
  await expect(removeButton).toBeVisible();

  await page.goto("/settings/extensions");
  await expect(page.getByTestId("extension-tile-grid").getByTestId("extension-tile-memories")).toBeVisible();

  await page.goto("/settings/extensions/memories");
  await own.getByRole("button", { name: "思い出を外す" }).click();
  await expect(page.getByText("外しました")).toBeVisible();
  await expect(own.getByRole("button", { name: "思い出を足す" })).toBeVisible();

  await page.goto("/settings/extensions");
  await expect(page.getByTestId("extension-tile-grid").getByTestId("extension-tile-memories")).toHaveCount(0);
});

test("使うグループは、管理者だけが切り替えられ、管理者でなければ状態だけを見せる", async ({ page, browser }) => {
  await signUp(page, { name: "こた" });
  await page.goto("/groups");
  await page.getByLabel("グループの名前").fill("ふたり");
  await page.getByRole("button", { name: "作る" }).click();
  await page.getByRole("button", { name: "招待リンクを作る" }).click();
  const inviteUrl = await page.getByLabel("招待リンク").inputValue();

  await page.goto("/settings/extensions/memories");
  const shared = page.getByRole("region", { name: "使うグループ" });
  const addButton = shared.getByRole("button", { name: "ふたりを足す" });
  await addButton.click();
  await expect(page.getByText("足しました")).toBeVisible();
  await expect(shared.getByRole("button", { name: "ふたりを外す" })).toBeVisible();

  // メンバーとして入った人には、ボタンではなく状態だけが出る
  const other = await (await browser.newContext()).newPage();
  await signUp(other, { name: "みか", next: new URL(inviteUrl).pathname });
  await other.getByRole("button", { name: "参加する" }).click();
  await expect(other).toHaveURL(/group=/);
  await other.goto("/settings/extensions/memories");
  const otherShared = other.getByRole("region", { name: "使うグループ" });
  await expect(otherShared.getByText("ふたり")).toBeVisible();
  await expect(otherShared.getByText("足しています")).toBeVisible();
  await expect(otherShared.getByRole("button", { name: /^ふたりを/ })).toHaveCount(0);
});

test("外部のカレンダーの詳細には、自分で使う・使うグループは出ず、その拡張の設定だけが出る", async ({ page }) => {
  await signUp(page);
  await page.goto("/settings/extensions/external");
  await expect(page.getByRole("heading", { name: "外部のカレンダー", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "自分で使う" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "使うグループ" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "外部のカレンダー" })).toBeVisible();
});

test("無い機能の詳細を開くと、見つからない知らせと一覧への道を出す", async ({ page }) => {
  await signUp(page);
  await page.goto("/settings/extensions/nothing");
  await expect(page.getByRole("heading", { name: "機能が見つかりません" })).toBeVisible();
  await page.getByRole("link", { name: "機能の一覧へ" }).click();
  await expect(page).toHaveURL(/\/settings\/extensions$/);
});
