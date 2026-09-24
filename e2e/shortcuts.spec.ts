import { expect, test } from "@playwright/test";
import { addExtension, signUp } from "./helpers";

/**
 * ホーム画面のアイコンを長押しした近道。#110
 * 「予定を足す」はカレンダーの上に新しい予定のシートを開いた状態、「ひとコマ」は撮る画面を開いた状態で起動する。
 */

test("manifest に、予定を足す・ひとコマ・支出を記録するの近道がある", async ({ page }) => {
  await page.goto("/login");
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  const res = await page.request.get(manifestHref!);
  const json = await res.json();
  expect(json.shortcuts).toEqual([
    expect.objectContaining({ name: "予定を足す", url: "/?new=1" }),
    expect.objectContaining({ name: "ひとコマ", url: "/memories/koma/now" }),
    expect.objectContaining({ name: "支出を記録する", url: "/kakeibo?record=1" }),
  ]);
  for (const shortcut of json.shortcuts) {
    expect(shortcut.icons[0].sizes).toBe("96x96");
  }
});

test("予定を足すの近道の URL を開くと、新しい予定のシートが開いた状態で始まる", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await page.goto("/?new=1");
  await expect(page.getByRole("dialog", { name: "新しい予定" })).toBeVisible();
  // 開いたら URL の印を消す。再読み込みしても開き直さないように
  await expect(page).toHaveURL(/\/$/);
});

test("ひとコマの近道の URL を開くと、撮る画面が開いた状態で始まる", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await addExtension(page, "思い出");
  await expect(page.getByText("足しました")).toBeVisible();

  await page.goto("/memories/koma/now");
  await expect(page).toHaveURL(/\/memories\/koma\/now$/);
  await expect(page.getByRole("heading", { name: "ひとコマ", level: 1 })).toBeVisible();
});

test("思い出を足していない人がひとコマの近道を開くと、機能の一覧へ案内する", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await page.goto("/memories/koma/now");
  await expect(page).toHaveURL(/\/settings\/extensions$/);
  await expect(page.getByText("思い出はまだ足していません")).toBeVisible();
});
