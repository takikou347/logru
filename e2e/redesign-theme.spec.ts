import { expect, test } from "@playwright/test";
import { enableNewLook, signUp } from "./helpers";

/**
 * 設定の「テーマ」に、水・夜空・木・季節を足した 6 つの見本が並び、選ぶと即座に html の
 * data-look へ効くことを確かめる。0095、issue #243
 */
test("テーマの画面に 6 つの見本が並び、選ぶと即座に切り替わる", async ({ page }) => {
  await signUp(page);
  await enableNewLook(page);
  await page.goto("/settings/theme");

  const group = page.getByRole("radiogroup", { name: "見た目の土台" });
  await expect(group).toBeVisible();
  // 既定の選択が「リキッドガラス」なので、先頭には既定以外を置く。同じ選択肢を続けて押しても
  // Radix の RadioGroup は onValueChange を呼ばないため、リキッドガラスは最後に回して確かめる
  const looks: { name: string; value: string }[] = [
    { name: "紙", value: "paper" },
    { name: "水", value: "water" },
    { name: "夜空", value: "night" },
    { name: "木", value: "wood" },
    { name: "季節", value: "season" },
    { name: "リキッドガラス", value: "glass" },
  ];
  for (const l of looks) {
    await expect(group.getByRole("radio", { name: l.name })).toBeVisible();
  }

  for (const l of looks) {
    await group.getByRole("radio", { name: l.name }).click();
    await expect(page.locator("html")).toHaveAttribute("data-look", l.value);
    // 端末に残る
    await expect.poll(() => page.evaluate(() => localStorage.getItem("logru-look"))).toBe(l.value);
  }

  // 読み込み直しても選んだ見た目のまま(public/theme-boot.js が起動時に当てる)
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-look", "glass");
});

/**
 * 季節のテーマは、日本時間の月で春夏秋冬を決める。E2E は page.clock で日時を止めて確かめる。0095
 */
test("季節のテーマは、日本時間の月で春夏秋冬を決める", async ({ page }) => {
  await signUp(page);
  await enableNewLook(page);

  const cases: { at: string; season: string }[] = [
    { at: "2026-04-10T10:00:00+09:00", season: "spring" },
    { at: "2026-07-10T10:00:00+09:00", season: "summer" },
    { at: "2026-10-10T10:00:00+09:00", season: "autumn" },
    { at: "2026-01-10T10:00:00+09:00", season: "winter" },
  ];
  for (const c of cases) {
    await page.clock.setFixedTime(new Date(c.at));
    await page.goto("/settings/theme");
    await page.getByRole("radiogroup", { name: "見た目の土台" }).getByRole("radio", { name: "季節" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-season", c.season);
  }
});
