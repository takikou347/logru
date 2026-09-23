import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

/** グループを作り、そのグループで思い出を有効にする。有効にした人は、自分でも使うことになる */
async function groupWithMemories(page: import("@playwright/test").Page, name: string) {
  await page.goto("/groups");
  await page.getByLabel("グループの名前").fill(name);
  await page.getByRole("button", { name: "作る" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await page.getByRole("switch", { name: "思い出" }).click();
  await expect(page.getByRole("switch", { name: "思い出" })).toBeChecked();
}

test("自分で思い出を使わないにすると、グループで有効でも入口も設定も出ない。0019", async ({ page }) => {
  await signUp(page);
  await groupWithMemories(page, "ふたり");
  await page.goto("/settings/extensions");
  const toggle = page.getByRole("switch", { name: "思い出を使う" });
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();

  await page.goto("/");
  await page.getByRole("toolbar", { name: "カレンダーの操作" }).getByRole("button", { name: "機能" }).click();
  const sheet = page.getByRole("dialog", { name: "機能" });
  await expect(sheet.getByRole("link", { name: /機能を足す、外す/ })).toBeVisible();
  await expect(sheet.getByRole("link", { name: /思い出/ })).toHaveCount(0);
  await expect(sheet.getByRole("link", { name: /記録する/ })).toHaveCount(0);

  await page.goto("/settings/notifications");
  await expect(page.getByRole("region", { name: "この端末の通知" })).toHaveCount(0);
  await page.goto("/memories");
  await expect(page).toHaveURL(/\/settings\/extensions$/);
});

test("記録はいつでも「共有しない」を選べる", async ({ page }) => {
  await signUp(page);
  await groupWithMemories(page, "ふたり");
  await page.goto("/memories?record=1");
  const sheet = page.getByRole("dialog", { name: "記録する" });
  const group = sheet.getByRole("radiogroup", { name: "共有するグループ" });
  await expect(group.getByRole("radio", { name: "共有しない" })).toHaveAttribute("aria-checked", "true");
  await expect(group.getByRole("radio", { name: "ふたり" })).toBeVisible();
  await sheet.getByLabel("文章").fill("ひとりのメモ");
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();
});

test("カレンダーの思い出は、その場で編集でき、思い出を開ける。記録は予定の一覧に混ざらない", async ({ page }) => {
  await signUp(page);
  await groupWithMemories(page, "ふたり");
  await page.goto("/memories");
  await page.getByRole("button", { name: "思い出を作る" }).click();
  await page.getByRole("dialog", { name: "思い出を作る" }).getByLabel("題名").fill("鎌倉 散歩");
  await page.getByRole("dialog", { name: "思い出を作る" }).getByRole("button", { name: "作る" }).click();
  await expect(page.getByRole("heading", { name: "鎌倉 散歩" })).toBeVisible();
  await page.getByRole("toolbar", { name: "1 日の操作" }).getByRole("button", { name: "記録する" }).click();
  await page.getByRole("dialog", { name: "記録する" }).getByLabel("文章").fill("出発");
  await page.getByRole("dialog", { name: "記録する" }).getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();

  await page.goto("/");
  const day = page.getByTestId("day-panel");
  const memory = day.getByRole("button", { name: /鎌倉 散歩/ });
  await expect(memory).toContainText("思い出");
  // 記録は予定の一覧ではなく、下に小さく出る
  await expect(day.getByRole("list").getByText(/記録 1/)).toHaveCount(0);
  await expect(day.getByRole("button", { name: /記録 1/ })).toBeVisible();

  await memory.click();
  const edit = page.getByRole("dialog", { name: "思い出を編集" });
  await edit.getByLabel("題名").fill("鎌倉 散歩と江ノ島");
  await edit.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("思い出を保存しました")).toBeVisible();
  await day.getByRole("button", { name: /鎌倉 散歩と江ノ島/ }).click();
  await page.getByRole("dialog", { name: "思い出を編集" }).getByRole("button", { name: "思い出を開く" }).click();
  await expect(page.getByRole("heading", { name: "鎌倉 散歩と江ノ島" })).toBeVisible();
});

test("予定を足すシートで日付を変えると、その日の予定に切り替わる", async ({ page }) => {
  await signUp(page);
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await sheet.getByLabel("題名").fill("明日の用事");
  const tomorrow = new Date(Date.now() + 86_400_000);
  const key = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  await sheet.getByLabel("日付").fill(key);
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予定を足しました")).toBeVisible();

  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const again = page.getByRole("dialog", { name: "新しい予定" });
  await expect(again.getByRole("region", { name: /の予定$/ })).toHaveCount(0);
  await again.getByLabel("日付").fill(key);
  await expect(
    again
      .getByRole("region", { name: `${tomorrow.getMonth() + 1}月${tomorrow.getDate()}日の予定` })
      .getByText("明日の用事"),
  ).toBeVisible();
});
