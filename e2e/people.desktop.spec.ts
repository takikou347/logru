import { expect, test } from "@playwright/test";
import { addEvent, dayPanel, signUp } from "./helpers";

test("PC は左の列の「表示する人」で、自分の予定を出し入れできる", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await addEvent(page, "歯医者");
  const people = page.getByRole("group", { name: "表示する人" });
  const self = people.getByRole("button", { name: "自分" });
  await expect(self).toHaveAttribute("aria-pressed", "true");

  await self.click();
  await expect(self).toHaveAttribute("aria-pressed", "false");
  await expect(dayPanel(page).getByRole("button", { name: /歯医者/ })).toHaveCount(0);

  await page.reload();
  await expect(self).toHaveAttribute("aria-pressed", "false");
  await expect(dayPanel(page).getByRole("button", { name: /歯医者/ })).toHaveCount(0);

  await self.click();
  await expect(dayPanel(page).getByRole("button", { name: /歯医者/ })).toBeVisible();
});
