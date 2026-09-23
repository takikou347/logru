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
