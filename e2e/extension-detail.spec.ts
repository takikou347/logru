import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

/**
 * 機能の一覧はカードにし、拡張ごとの詳細に「自分で使う」「使うグループ」「その拡張の設定」を集める。issue #102
 * 決まり: 拡張の設定は、その拡張の詳細に置く。
 */

test("カードは一覧に並び、いつでも使える拡張には「使う」の切り替えを出さない", async ({ page }) => {
  await signUp(page);
  await page.goto("/settings/extensions");
  const memories = page.getByRole("region", { name: "思い出" });
  await expect(memories.getByRole("switch", { name: "思い出を使う" })).not.toBeChecked();
  const external = page.getByRole("region", { name: "外部のカレンダー" });
  await expect(external.getByText("いつでも使えます")).toBeVisible();
  await expect(external.getByRole("switch")).toHaveCount(0);
});

test("カードから拡張の詳細へ移り、自分で使うを切り替えられる。切り替えは一覧にも反映する", async ({ page }) => {
  await signUp(page);
  await page.goto("/settings/extensions");
  await page.getByRole("link", { name: /^思い出/ }).click();
  await expect(page).toHaveURL(/\/settings\/extensions\/memories$/);
  await expect(page.getByRole("heading", { name: "思い出" })).toBeVisible();

  const own = page.getByRole("region", { name: "自分で使う" });
  const toggle = own.getByRole("switch", { name: "思い出を使う" });
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(page.getByText("使えるようにしました")).toBeVisible();
  await expect(toggle).toBeChecked();

  await page.goto("/settings/extensions");
  await expect(
    page.getByRole("region", { name: "思い出" }).getByRole("switch", { name: "思い出を使う" }),
  ).toBeChecked();
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
  const row = shared.getByRole("switch", { name: "ふたり" });
  await expect(row).not.toBeChecked();
  await row.click();
  await expect(page.getByText("使えるようにしました")).toBeVisible();
  await expect(row).toBeChecked();

  // メンバーとして入った人には、切り替えではなく状態だけが出る
  const other = await (await browser.newContext()).newPage();
  await signUp(other, { name: "みか", next: new URL(inviteUrl).pathname });
  await other.getByRole("button", { name: "参加する" }).click();
  await other.goto("/settings/extensions/memories");
  const otherShared = other.getByRole("region", { name: "使うグループ" });
  await expect(otherShared.getByText("ふたり")).toBeVisible();
  await expect(otherShared.getByText("使っています")).toBeVisible();
  await expect(otherShared.getByRole("switch", { name: "ふたり" })).toHaveCount(0);
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
