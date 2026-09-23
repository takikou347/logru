import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

/**
 * ラボ。0038、0039、F-35
 *
 * この e2e は development の組み立てで流れ、showLab は staging と同じ true になる。
 * 本番で出ない側は、GET /api/me を showLab: false に差し替えて確かめる。
 */

test.beforeEach(async ({ page }) => {
  await signUp(page);
  await page.goto("/settings");
});

test("staging と同じ組み立てでは、ラボの欄が出て、見本を入り切りできる", async ({ page }) => {
  const lab = page.getByRole("region", { name: "ラボ" });
  await expect(lab).toBeVisible();
  const toggle = lab.getByRole("switch", { name: "見本: 開発の印" });
  await expect(toggle).not.toBeChecked();
  await expect(page.locator("html")).not.toHaveAttribute("data-lab-sample-marker");

  await toggle.click();
  await expect(toggle).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-lab-sample-marker", "");

  // この端末に残り、読み込み直しても入ったまま
  await page.reload();
  await expect(lab.getByRole("switch", { name: "見本: 開発の印" })).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-lab-sample-marker", "");

  // 切ると、この端末からも消える
  await lab.getByRole("switch", { name: "見本: 開発の印" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-lab-sample-marker");
  await page.reload();
  await expect(page.locator("html")).not.toHaveAttribute("data-lab-sample-marker");
});

test("本番では欄が出ない", async ({ page }) => {
  // GET /api/me の showLab だけを差し替える。本番の組み立てを再現する
  await page.context().route("**/api/me", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: { ...body, showLab: false } });
  });
  await page.reload();
  await expect(page.getByRole("region", { name: "ラボ" })).toHaveCount(0);
});
