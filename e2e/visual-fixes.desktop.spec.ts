import { expect, test } from "@playwright/test";
import { addExtension, signUp } from "./helpers";

/** PC の「+」は、面(白い帯)の中に出さず、ほかの PC の画面と同じく中身の末尾に「+」だけを置く。logru#275 */

test("PC で、下の操作の「+」の親に白い帯(背景・枠・影)が無い", async ({ page }) => {
  await signUp(page);
  await addExtension(page, "家計簿");
  await addExtension(page, "思い出");

  const screens = [
    { url: "/kakeibo/budgets", toolbar: "予算の操作" },
    { url: "/kakeibo/accounts", toolbar: "口座の操作" },
    { url: "/kakeibo/recurrings", toolbar: "定期の記録の操作" },
    { url: "/memories", toolbar: "思い出の操作" },
  ];
  for (const { url, toolbar } of screens) {
    await page.goto(url);
    const dock = page.getByRole("toolbar", { name: toolbar });
    await expect(dock).toBeVisible();
    await expect(dock).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(dock).toHaveCSS("background-image", "none");
    await expect(dock).toHaveCSS("border-top-width", "0px");
    await expect(dock).toHaveCSS("box-shadow", "none");
  }
});
