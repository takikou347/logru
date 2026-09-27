import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

/**
 * 毎年の予定の種別(誕生日・記念日)。F-48、0097
 * 今日を 2026-09-24(木)に固定し、2021-09-27 始まりの毎年の予定を作る。次の回は 2026-09-27 で、
 * 今日から 3 日後。始まりの年から 5 年後なので「5 年目」も出る。
 */
test.describe("毎年の予定の種別", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-09-24T09:00:00+09:00"));
    await page.reload();
  });

  test("記念日を選ぶと、記念日の帯が出る。誕生日と文言が違い、何年目も添える", async ({ page }) => {
    await page.getByRole("button", { name: "予定を足す" }).last().click();
    const sheet = page.getByRole("dialog", { name: "新しい予定" });
    await sheet.getByLabel("題名").fill("結婚記念日");
    await sheet.getByLabel("日付").fill("2021-09-27");
    await sheet.getByRole("radio", { name: "毎年" }).click();
    await sheet.getByRole("radio", { name: "記念日" }).click();
    await sheet.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByText("予定を足しました")).toBeVisible();

    await page.reload();
    const band = page.getByTestId("shortcut-band").filter({ visible: true });
    await expect(band).toContainText("結婚記念日まで");
    await expect(band).toContainText("あと3日");
    await expect(band).toContainText("5年目");
  });

  test("誕生日は種別を変えなければ、今までどおりの文言のまま", async ({ page }) => {
    await page.getByRole("button", { name: "予定を足す" }).last().click();
    const sheet = page.getByRole("dialog", { name: "新しい予定" });
    await sheet.getByLabel("題名").fill("けんたの誕生日");
    await sheet.getByLabel("日付").fill("2021-09-27");
    await sheet.getByRole("radio", { name: "毎年" }).click();
    // 誕生日が既定のまま。記念日の種類は選ばない
    await expect(sheet.getByRole("radio", { name: "誕生日" })).toHaveAttribute("aria-checked", "true");
    await sheet.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByText("予定を足しました")).toBeVisible();

    await page.reload();
    const band = page.getByTestId("shortcut-band").filter({ visible: true });
    await expect(band).toContainText("けんたの誕生日");
    await expect(band).toContainText("9月27日");
    await expect(band).toContainText("あと3日");
    // 記念日向けの文言(まで、の日、年目)は出ない
    await expect(band).not.toContainText("まで");
    await expect(band).not.toContainText("年目");
  });

  test("種別を変えて保存できる", async ({ page }) => {
    await page.getByRole("button", { name: "予定を足す" }).last().click();
    const sheet = page.getByRole("dialog", { name: "新しい予定" });
    await sheet.getByLabel("題名").fill("開店記念日");
    await sheet.getByRole("radio", { name: "毎年" }).click();
    await expect(sheet.getByRole("radio", { name: "誕生日" })).toHaveAttribute("aria-checked", "true");
    await sheet.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByText("予定を足しました")).toBeVisible();

    // 直すシートを開き、記念日に変えて保存する
    await page
      .getByRole("button", { name: /開店記念日/ })
      .first()
      .click();
    const editSheet = page.getByRole("dialog", { name: "予定を直す" });
    await expect(editSheet.getByRole("radio", { name: "誕生日" })).toHaveAttribute("aria-checked", "true");
    await editSheet.getByRole("radio", { name: "記念日" }).click();
    await editSheet.getByRole("button", { name: "保存する" }).click();
    // 繰り返す予定を直すときは、範囲(この回だけ・これ以降・全部)を選ぶ。0043
    await page.getByRole("dialog", { name: "どの回を直しますか" }).getByRole("button", { name: "全部" }).click();
    await expect(page.getByText("予定を保存しました")).toBeVisible();

    // 開き直して、記念日が選ばれたままになっているのを確かめる
    await page
      .getByRole("button", { name: /開店記念日/ })
      .first()
      .click();
    await expect(
      page.getByRole("dialog", { name: "予定を直す" }).getByRole("radio", { name: "記念日" }),
    ).toHaveAttribute("aria-checked", "true");
  });
});
