import { expect, test } from "@playwright/test";
import { addEventButton, enableOldLook, signUp } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

/**
 * 毎年の予定の種別(誕生日・記念日)。F-48、0097
 * 近道の帯は、サーバーが本物の今日(UTC の暦)から 7 日以内の回を探す。page.clock で止まるのは
 * 画面の側だけなので、日付は流した日から組み立てる。サーバーの今日から 3 日後の回で、始まりは 5 年前。
 * 画面の時計はサーバーの今日の日本時間 9 時に止め、「あと3日」がぶれないようにする。
 */
const DAY = 24 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const realNow = new Date();
const serverToday = new Date(Date.UTC(realNow.getUTCFullYear(), realNow.getUTCMonth(), realNow.getUTCDate()));
// 2 月 29 日の回は年ごとに無くなるので、3 日後がその日に当たるときは 2 日後にする
const daysAhead = new Date(serverToday.getTime() + 3 * DAY).toISOString().slice(5, 10) === "02-29" ? 2 : 3;
const daysLabel = `あと${daysAhead}日`;
const occurrence = new Date(serverToday.getTime() + daysAhead * DAY);
const startDate = `${occurrence.getUTCFullYear() - 5}${ymd(occurrence).slice(4)}`;
const occurrenceLabel = `${occurrence.getUTCMonth() + 1}月${occurrence.getUTCDate()}日`;
const clientNow = new Date(`${ymd(serverToday)}T09:00:00+09:00`);

test.describe("毎年の予定の種別", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(clientNow);
    await page.reload();
  });

  test("記念日を選ぶと、記念日の帯が出る。誕生日と文言が違い、何年目も添える", async ({ page }) => {
    await addEventButton(page);
    const sheet = page.getByRole("dialog", { name: "新しい予定" });
    await sheet.getByLabel("題名").fill("結婚記念日");
    await sheet.getByLabel("日付").fill(startDate);
    await sheet.getByRole("radio", { name: "毎年" }).click();
    await sheet.getByRole("radio", { name: "記念日" }).click();
    await sheet.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByText("予定を足しました")).toBeVisible();

    // 近道の帯(ShortcutBand)は新しい見た目・スマホの今日のページには無い(PC の左の列にだけある)。
    // 前の見た目に戻して確かめる
    await enableOldLook(page);
    await page.reload();
    const band = page.getByTestId("shortcut-band").filter({ visible: true });
    await expect(band).toContainText("結婚記念日まで");
    await expect(band).toContainText(daysLabel);
    await expect(band).toContainText("5年目");
  });

  test("誕生日は種別を変えなければ、今までどおりの文言のまま", async ({ page }) => {
    await addEventButton(page);
    const sheet = page.getByRole("dialog", { name: "新しい予定" });
    await sheet.getByLabel("題名").fill("けんたの誕生日");
    await sheet.getByLabel("日付").fill(startDate);
    await sheet.getByRole("radio", { name: "毎年" }).click();
    // 誕生日が既定のまま。記念日の種類は選ばない
    await expect(sheet.getByRole("radio", { name: "誕生日" })).toHaveAttribute("aria-checked", "true");
    await sheet.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByText("予定を足しました")).toBeVisible();

    // 近道の帯(ShortcutBand)は新しい見た目・スマホの今日のページには無い(PC の左の列にだけある)。
    // 前の見た目に戻して確かめる
    await enableOldLook(page);
    await page.reload();
    const band = page.getByTestId("shortcut-band").filter({ visible: true });
    await expect(band).toContainText("けんたの誕生日");
    await expect(band).toContainText(occurrenceLabel);
    await expect(band).toContainText(daysLabel);
    // 記念日向けの文言(まで、の日、年目)は出ない
    await expect(band).not.toContainText("まで");
    await expect(band).not.toContainText("年目");
  });

  test("種別を変えて保存できる", async ({ page }) => {
    await addEventButton(page);
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
