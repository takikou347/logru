import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { addEventButton, addMemories, enableOldLook, removeExtension, signUp, tokyoDateParts } from "./helpers";

const PHOTO = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/photo.jpg");

/** グループを作り、そのグループで思い出を足す。足した人は、自分でも使うことになる */
async function groupWithMemories(page: import("@playwright/test").Page, name: string) {
  await page.goto("/groups");
  await page.getByLabel("グループの名前").fill(name);
  await page.getByRole("button", { name: "作る" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await page.getByRole("button", { name: "思い出を足す" }).click();
  await expect(page.getByRole("button", { name: "思い出を外す" })).toBeVisible();
}

test("自分で思い出を外すと、グループでは足していても入口も設定も出ない。0019", async ({ page }) => {
  await signUp(page);
  await groupWithMemories(page, "ふたり");
  await removeExtension(page, "思い出");
  await expect(page.getByText("外しました")).toBeVisible();

  // カレンダーの Dock(role="toolbar")の「機能」ダイアログは、新しい見た目・スマホでは下のタブの
  // 帯に役目を移して隠れる(0091)ため、前の見た目に戻して確かめる
  await enableOldLook(page);
  await page.goto("/");
  await page.getByRole("toolbar", { name: "カレンダーの操作" }).getByRole("button", { name: "機能" }).click();
  const sheet = page.getByRole("dialog", { name: "機能" });
  await expect(sheet.getByRole("link", { name: "機能を足す" })).toBeVisible();
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
  const shareRow = sheet.getByRole("button", { name: /^共有/ });
  await expect(shareRow).toContainText("自分だけ");
  await shareRow.click();
  const picker = page.getByRole("dialog", { name: "共有する相手" });
  await expect(picker.getByRole("option", { name: "共有しない" })).toHaveAttribute("aria-selected", "true");
  await expect(picker.getByRole("option", { name: "ふたり" })).toBeVisible();
  // 選んでいる行をもう一度押して、値を変えずに閉じる
  await picker.getByRole("option", { name: "共有しない" }).click();
  await sheet.getByLabel("文章").fill("ひとりのメモ");
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();
});

test("共有する相手の一覧は上下キーで前後の行へ移れる。#249", async ({ page }) => {
  await signUp(page);
  await groupWithMemories(page, "ふたり");
  await page.goto("/memories?record=1");
  const sheet = page.getByRole("dialog", { name: "記録する" });
  await sheet.getByRole("button", { name: /^共有/ }).click();
  const picker = page.getByRole("dialog", { name: "共有する相手" });
  const none = picker.getByRole("option", { name: "共有しない" });
  const futari = picker.getByRole("option", { name: "ふたり" });

  await none.focus();
  await expect(none).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(futari).toBeFocused();
  // 端では何もしない
  await page.keyboard.press("ArrowDown");
  await expect(futari).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(none).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(none).toBeFocused();

  // フォーカスしている行を Enter で選べる
  await futari.focus();
  await page.keyboard.press("Enter");
  await expect(picker).toBeHidden();
  await expect(sheet.getByRole("button", { name: /^共有/ })).toContainText("ふたり");
});

test("写真を足した後も共有先を変えられる。保存すると選んだ共有先に付く。0057、#158", async ({ page }) => {
  await signUp(page);
  await groupWithMemories(page, "ふたり");
  await page.goto("/memories?record=1");
  const sheet = page.getByRole("dialog", { name: "記録する" });
  const shareRow = sheet.getByRole("button", { name: /^共有/ });
  await expect(shareRow).toContainText("自分だけ");

  await sheet.locator('input[type="file"][multiple]').setInputFiles(PHOTO);
  await expect(sheet.getByRole("button", { name: "保存する" })).toBeEnabled({ timeout: 15_000 });
  // 写真を足した後も、共有の行はそのまま押せる
  await expect(shareRow).toBeEnabled();

  await shareRow.click();
  const picker = page.getByRole("dialog", { name: "共有する相手" });
  await picker.getByRole("option", { name: "ふたり" }).click();
  await expect(shareRow).toContainText("ふたり");

  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();
});

test("カレンダーの思い出は、その場で編集でき、思い出を開ける。記録は予定の一覧に混ざらない", async ({ page }) => {
  await signUp(page);
  await groupWithMemories(page, "ふたり");
  await page.goto("/memories");
  await addMemories(page, "思い出を作る");
  await page.getByRole("dialog", { name: "思い出を作る" }).getByLabel("題名").fill("鎌倉 散歩");
  await page.getByRole("dialog", { name: "思い出を作る" }).getByRole("button", { name: "作る" }).click();
  await expect(page.getByRole("heading", { name: "鎌倉 散歩" })).toBeVisible();
  await page.getByRole("toolbar", { name: "1 日の操作" }).getByRole("button", { name: "記録する" }).click();
  await page.getByRole("dialog", { name: "記録する" }).getByLabel("文章").fill("出発");
  await page.getByRole("dialog", { name: "記録する" }).getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();

  // カレンダーの day-panel を使うため、前の見た目に戻して確かめる(0091)
  await enableOldLook(page);
  await page.goto("/");
  const day = page.getByTestId("day-panel");
  // 思い出は「思い出」の見出しの下にまとまる。予定は無いので「予定」の見出しは出ない。0056
  await expect(day.getByRole("group", { name: "予定" })).toHaveCount(0);
  const memories = day.getByRole("group", { name: "思い出" });
  const memory = memories.getByRole("button", { name: /鎌倉 散歩/ });
  await expect(memory).toContainText("思い出");
  await expect(memories.getByRole("button", { name: /記録 1/ })).toBeVisible();

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
  await addEventButton(page);
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await sheet.getByLabel("題名").fill("明日の用事");
  const { key, month, day } = tokyoDateParts(1);
  await sheet.getByLabel("日付").fill(key);
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予定を足しました")).toBeVisible();

  await addEventButton(page);
  const again = page.getByRole("dialog", { name: "新しい予定" });
  await expect(again.getByRole("region", { name: /の予定$/ })).toHaveCount(0);
  await again.getByLabel("日付").fill(key);
  const list = again.getByRole("region", { name: `${month}月${day}日の予定` });
  // 一覧は畳んだ 1 行で出るので、開いてから中身を確かめる。issue #200
  await list.getByRole("button", { name: `${month}月${day}日の予定` }).click();
  await expect(list.getByText("明日の用事")).toBeVisible();
});
