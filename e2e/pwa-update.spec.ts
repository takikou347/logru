import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("新しい Service Worker が入っても、シートに入力の途中なら読み込み直さない。閉じると切り替わり、知らせが出る", async ({
  page,
}) => {
  await signUp(page);

  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  const title = sheet.getByLabel("題名");
  await title.fill("消えたら困る予定");

  // 新しい Service Worker が画面を受け持った、を装う
  await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event("controllerchange")));

  // 読み込み直していれば、シートも入れた題名も消える。少し待っても残っていることを確かめる
  await page.waitForTimeout(300);
  await expect(sheet).toBeVisible();
  await expect(title).toHaveValue("消えたら困る予定");

  // シートを閉じると、延ばしていた読み込み直しが行われ、知らせが 1 回出る
  await sheet.getByRole("button", { name: "閉じる" }).click();
  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();
  await expect(page.getByText("新しい版にしました")).toBeVisible();
});

test("入力していなければ、シートを開いたままでも読み込み直す", async ({ page }) => {
  await signUp(page);

  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await expect(sheet).toBeVisible();

  await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event("controllerchange")));

  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();
  await expect(page.getByText("新しい版にしました")).toBeVisible();
});
