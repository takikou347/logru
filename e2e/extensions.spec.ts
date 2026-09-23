import { expect, test } from "@playwright/test";
import { addExtension, signUp } from "./helpers";

test("下の操作の「機能」で機能のシートが開き、「+」で機能を足す画面へ移れる。issue #145", async ({ page }) => {
  await signUp(page);
  await page.getByRole("toolbar", { name: "カレンダーの操作" }).getByRole("button", { name: "機能" }).click();
  const sheet = page.getByRole("dialog", { name: "機能" });
  await expect(sheet.getByRole("link", { name: /グループ/ })).toBeVisible();
  await sheet.getByRole("link", { name: "機能を足す" }).click();
  await expect(page).toHaveURL(/\/settings\/extensions\/add$/);
  await expect(page.getByRole("heading", { name: "機能を足す" })).toBeVisible();
});

test("機能のタイルは、長い名前の代わりに短い名前を出す。issue #21", async ({ page }) => {
  await signUp(page);
  await page.goto("/settings/extensions");
  await expect(page.getByTestId("extension-tile-external").getByText("外部カレンダー")).toBeVisible();
  await expect(page.getByTestId("extension-tile-external").getByText("外部のカレンダー")).toHaveCount(0);
});

test("「予定を足す」は予定のシートだけを開く", async ({ page }) => {
  await signUp(page);
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  await expect(page.getByRole("dialog", { name: "新しい予定" })).toBeVisible();
});

test("外すと確認のシートに「記録は消えません」と出る。外して足し直しても記録は残る。issue #145", async ({ page }) => {
  await signUp(page);
  await addExtension(page, "家計簿");
  await page.goto("/kakeibo");
  await page.getByRole("button", { name: "支出を記録する" }).click();
  const create = page.getByRole("dialog", { name: "記録する" });
  await create.getByLabel("金額").fill("1200");
  await create.getByRole("radio", { name: "食費" }).click();
  await create.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();
  await expect(page.getByTestId("kakeibo-total")).toHaveText("¥1,200");

  // タイルの中に、拡張が渡す短い字(今月の合計)が出る。issue #145
  await page.goto("/settings/extensions");
  await expect(page.getByTestId("extension-tile-kakeibo").getByText("¥1,200")).toBeVisible();
  await page.getByRole("button", { name: "並びを変える" }).click();
  await page.getByRole("button", { name: "家計簿を外す" }).click();
  const confirm = page.getByRole("dialog", { name: "家計簿を外しますか" });
  await expect(confirm.getByText("記録は消えません。また足すと戻ります。")).toBeVisible();
  await confirm.getByRole("button", { name: "外す" }).click();
  await expect(page.getByText("家計簿を外しました")).toBeVisible();
  await expect(page.getByTestId("extension-tile-grid").getByTestId("extension-tile-kakeibo")).toHaveCount(0);

  // 外している間は開けない
  await page.goto("/kakeibo");
  await expect(page).toHaveURL(/\/settings\/extensions$/);

  // また足すと、記録はそのまま残っている。実際に消していないことの確認
  await addExtension(page, "家計簿");
  await page.goto("/kakeibo");
  await expect(page.getByTestId("kakeibo-total")).toHaveText("¥1,200");
});

test("グループが多くても、グループの絞り込みは横に流れて全部押せる", async ({ page }) => {
  await signUp(page);
  for (const name of ["ふたり", "実家", "大学の友人", "職場の同期", "フットサル", "町内会"]) {
    await page.goto("/groups");
    await page.getByLabel("グループの名前").fill(name);
    await page.getByRole("button", { name: "作る" }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "グループで絞る" });
  const last = nav.getByRole("button", { name: "町内会" });
  await last.scrollIntoViewIfNeeded();
  await last.click();
  await expect(last).toHaveAttribute("aria-pressed", "true");
});
