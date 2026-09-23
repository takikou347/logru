import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("PC の設定は左に目次、右に中身の 2 列で、目次から節を切り替えられる。issue #102", async ({ page }) => {
  await signUp(page);
  await page.goto("/settings");
  // PC では常にどれかの節が開いている。最初は「見た目」
  await expect(page).toHaveURL(/\/settings\/appearance$/);
  const toc = page.getByRole("navigation", { name: "設定の目次" });
  await expect(toc.getByRole("link", { name: "見た目" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "見た目" })).toBeVisible();
  // 目次の戻るボタンは出さない。目次自体が PC では左に残っているため
  await expect(page.getByRole("link", { name: "戻る" })).toBeHidden();

  await toc.getByRole("link", { name: "アカウント" }).click();
  await expect(page).toHaveURL(/\/settings\/account$/);
  await expect(page.getByRole("heading", { name: "アカウント", level: 1 })).toBeVisible();
  await expect(toc.getByRole("link", { name: "アカウント" })).toHaveAttribute("aria-current", "page");
});

test("PC の左の列で、選ばれた色が目次の 1 か所だけになる。issue #13", async ({ page }) => {
  await signUp(page);
  await page.goto("/settings/extensions");
  const aside = page.getByRole("complementary", { name: "メニュー" });
  // 上のアプリの行き先の「機能を足す、外す」と、下の目次の「機能」が同じ場所を指しても、
  // 選ばれた色になるのは目次の側の 1 か所だけ
  await expect(aside.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(aside.getByRole("heading", { name: "設定" })).toBeVisible();
  await expect(aside.getByRole("link", { name: "機能を足す、外す" })).not.toHaveAttribute("aria-current", "page");
});
