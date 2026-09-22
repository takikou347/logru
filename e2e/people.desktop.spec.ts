import { expect, type Page, test } from "@playwright/test";
import { addEvent, dayPanel, signUp } from "./helpers";

async function createGroup(page: Page, name: string) {
  await page.goto("/groups");
  await page.getByLabel("グループの名前").fill(name);
  await page.getByRole("button", { name: "作る" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

test("PC は左の列のグループを開き、メンバーごとに予定を出し入れできる", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await createGroup(page, "ふたり");
  await createGroup(page, "実家");
  await page.goto("/");
  await addEvent(page, "歯医者", "ふたり");

  const side = page.getByRole("group", { name: "表示するグループ" });
  const toggle = side.getByRole("button", { name: "ふたり のメンバー" });
  const members = side.getByRole("group", { name: "ふたり のメンバー" });

  // はじめは閉じている。矢印で開くと、自分が並ぶ
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(members).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const self = members.getByRole("button", { name: "自分" });
  await expect(self).toHaveAttribute("aria-pressed", "true");

  // 自分の印を外すと自分の予定が消え、ほかのグループの「自分」も外れる
  await self.click();
  await expect(self).toHaveAttribute("aria-pressed", "false");
  await expect(dayPanel(page).getByRole("button", { name: /歯医者/ })).toHaveCount(0);
  await side.getByRole("button", { name: "実家 のメンバー" }).click();
  await expect(
    side.getByRole("group", { name: "実家 のメンバー" }).getByRole("button", { name: "自分" }),
  ).toHaveAttribute("aria-pressed", "false");

  // 読み込み直しても、開け閉めと印は同じ
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(self).toHaveAttribute("aria-pressed", "false");
  await expect(dayPanel(page).getByRole("button", { name: /歯医者/ })).toHaveCount(0);

  await self.click();
  await expect(dayPanel(page).getByRole("button", { name: /歯医者/ })).toBeVisible();

  // グループの名前を押すと、いままでどおりそのグループで絞る
  await side.getByRole("button", { name: "ふたり", exact: true }).click();
  await expect(page).toHaveURL(/group=/);
  await expect(side.getByRole("button", { name: "ふたり", exact: true })).toHaveAttribute("aria-pressed", "true");

  // 閉じると、次に開いたときも閉じている
  await toggle.click();
  await expect(members).toHaveCount(0);
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});
