import { expect, type Page, test } from "@playwright/test";
import { addEvent, addExtension, dayPanel, pickShare, signUp } from "./helpers";

/** グループを作り、カレンダーへ戻る */
async function createGroup(page: Page, name: string) {
  await page.goto("/groups");
  await page.getByLabel("グループの名前").fill(name);
  await page.getByRole("button", { name: "作る" }).click();
  await expect(page).toHaveURL(/\/groups\//);
  await page.goto("/");
}

/** 設定の「アカウント」から、いつもの共有先を選ぶ */
async function setUsualShare(page: Page, name: string) {
  await page.goto("/settings/account");
  const section = page.getByRole("region", { name: "いつもの共有先" });
  await pickShare(page, section, name);
}

test("設定でいつもの共有先を決めると、次に足す予定の既定になり、行に小さく添える。0063、F-40", async ({ page }) => {
  await signUp(page);
  await createGroup(page, "ふたり");
  await setUsualShare(page, "ふたり");

  await page.goto("/");
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  const shareRow = sheet.getByRole("button", { name: /^共有/ });
  await expect(shareRow).toContainText("ふたり");
  await expect(shareRow).toContainText("いつもの共有先");
});

test("画面でグループを絞っているときは、いつもの共有先より絞りを優先する。0063、F-40", async ({ page }) => {
  await signUp(page);
  await createGroup(page, "ふたり");
  await createGroup(page, "かぞく");
  await setUsualShare(page, "ふたり");

  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "グループで絞る" });
  await nav.getByRole("button", { name: "かぞく" }).click();
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  const shareRow = sheet.getByRole("button", { name: /^共有/ });
  await expect(shareRow).toContainText("かぞく");
  await expect(shareRow).not.toContainText("いつもの共有先");
});

test("いつもの共有先が、その拡張を足していないグループなら、共有しないが既定になる。0063、F-40", async ({ page }) => {
  await signUp(page);
  await addExtension(page, "家計簿");
  // 「ふたり」には家計簿を足さないまま、いつもの共有先にする
  await createGroup(page, "ふたり");
  await setUsualShare(page, "ふたり");

  await page.goto("/kakeibo");
  // 空の月は、下の帯の主なボタンと空の表示のボタンが同じ「支出を記録する」を名乗るので、帯の方を選ぶ
  await page.getByRole("toolbar", { name: "家計簿の操作" }).getByRole("button", { name: "支出を記録する" }).click();
  const sheet = page.getByRole("dialog", { name: "記録する" });
  await expect(sheet.getByRole("button", { name: /^共有/ })).toContainText("自分だけ");
});

test("共有のグループが 1 つのとき、いつもの共有先にするか 1 回だけ聞き、断ると二度と出ない。0063、F-40", async ({
  page,
}) => {
  await signUp(page);
  await createGroup(page, "ふたり");

  await page.goto("/");
  const banner = page.getByRole("status", { name: "いつもの共有先の案内" });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("ふたり");
  await banner.getByRole("button", { name: "いつもの共有先にするかの案内を閉じる" }).click();
  await expect(banner).toBeHidden();

  await page.reload();
  await expect(page.getByRole("status", { name: "いつもの共有先の案内" })).toHaveCount(0);

  // 断ったので、いつもの共有先は「共有しない」のまま。行では「自分だけ」と出す。0059、#164
  await page.goto("/settings/account");
  const section = page.getByRole("region", { name: "いつもの共有先" });
  await expect(section.getByRole("button", { name: /^共有/ })).toContainText("自分だけ");
});

test("聞かれて「する」を選ぶと、そのグループが次に足す予定の既定になる。0063、F-40", async ({ page }) => {
  await signUp(page);
  await createGroup(page, "ふたり");

  await page.goto("/");
  const banner = page.getByRole("status", { name: "いつもの共有先の案内" });
  await banner.getByRole("button", { name: "する", exact: true }).click();
  await expect(page.getByText("「ふたり」をいつもの共有先にしました")).toBeVisible();
  await expect(banner).toBeHidden();

  await addEvent(page, "打ち合わせ");
  await dayPanel(page)
    .getByRole("button", { name: /打ち合わせ/ })
    .click();
  const sheet = page.getByRole("dialog", { name: "予定を直す" });
  await expect(sheet.getByRole("button", { name: /^共有/ })).toContainText("ふたり");
});
