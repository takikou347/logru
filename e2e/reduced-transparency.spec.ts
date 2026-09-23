import { expect, type Page, test } from "@playwright/test";
import { signUp } from "./helpers";

/**
 * 端末の「透明度を下げる」を有効にする。Playwright の emulateMedia には無いので CDP を直に呼ぶ。#95
 */
async function enableReducedTransparency(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
  });
}

test("ログイン前は、端末の透明度を下げる設定で背景が平らになる。#95", async ({ page }) => {
  await enableReducedTransparency(page);
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-bg-theme", "flat");
});

test("端末の透明度を下げる設定が無ければ、背景は既定のガラスのまま。#95", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-bg-theme", "glass");
});

test("端末の透明度を下げる設定でも、ガラスを選んでいれば奥を透かす。#95", async ({ page }) => {
  await signUp(page);
  await enableReducedTransparency(page);
  await page.goto("/settings");
  await expect(page.getByRole("radio", { name: "ガラス" })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("html")).toHaveAttribute("data-bg-theme", "glass");
  // data-bg-theme=glass のときは、端末の設定に関わらず --blur が効いたままになる
  const blur = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--blur").trim());
  expect(blur).not.toBe("none");
});
