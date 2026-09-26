import { expect, test } from "@playwright/test";
import { addEvent, dayPanel, pickShare, signUp } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("予定を足すと、選んだ日の欄に出る", async ({ page }) => {
  await addEvent(page, "歯医者");
  const panel = dayPanel(page);
  await expect(panel.getByRole("button", { name: /歯医者/ })).toBeVisible();
  await expect(panel.getByText("自分だけ", { exact: true })).toBeVisible();
});

test("予定は「共有しない」が既定で、「自分だけの予定」で絞ると共有していない予定だけになる", async ({ page }) => {
  await page.goto("/groups");
  await page.getByLabel("グループの名前").fill("ふたり");
  await page.getByRole("button", { name: "作る" }).click();
  await expect(page.getByRole("heading", { name: "ふたり" })).toBeVisible();
  await page.goto("/");

  // シートは「共有しない」を選んだ状態で開く。行では「自分だけ」と出す。0059、#164
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  const shareRow = sheet.getByRole("button", { name: /^共有/ });
  await expect(shareRow).toContainText("自分だけ");
  await expect(sheet.getByText("自分だけに見えます。")).toBeVisible();
  await pickShare(page, sheet, "ふたり");
  await expect(sheet.getByText("「ふたり」のメンバー全員に見えます。")).toBeVisible();
  await pickShare(page, sheet, "共有しない");
  await sheet.getByLabel("題名").fill("ひとりの用事");
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予定を足しました")).toBeVisible();
  await addEvent(page, "ふたりの用事", "ふたり");

  const filter = page.getByRole("navigation", { name: "グループで絞る" });
  await filter.getByRole("button", { name: "自分だけの予定" }).click();
  await expect(dayPanel(page).getByRole("button", { name: /ひとりの用事/ })).toBeVisible();
  await expect(dayPanel(page).getByRole("button", { name: /ふたりの用事/ })).toHaveCount(0);

  // グループで絞っているときは、そのグループを選んでシートが開く
  await filter.getByRole("button", { name: "ふたり" }).click();
  await expect(dayPanel(page).getByRole("button", { name: /ひとりの用事/ })).toHaveCount(0);
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  await expect(page.getByRole("dialog", { name: "新しい予定" }).getByRole("button", { name: /^共有/ })).toContainText(
    "ふたり",
  );
});

test("グループの一覧が届く前にシートを開いても、自分だけのグループに保存できる", async ({ page }) => {
  // グループの一覧を遅らせ、届く前にシートを開いて題名を入れる
  await page.context().route("**/api/groups", async (route) => {
    await new Promise((r) => setTimeout(r, 2_000));
    await route.continue();
  });
  await page.reload();
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await sheet.getByLabel("題名").fill("読み込み中に足す");
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予定を足しました")).toBeVisible();
  await expect(dayPanel(page).getByRole("button", { name: /読み込み中に足す/ })).toBeVisible();
});

test("題名が空なら保存できない", async ({ page }) => {
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await expect(sheet.getByRole("button", { name: "保存する" })).toBeDisabled();
  await sheet.getByLabel("題名").fill("   ");
  await expect(sheet.getByRole("button", { name: "保存する" })).toBeDisabled();
});

test("予定を直せる", async ({ page }) => {
  await addEvent(page, "買い物");
  await dayPanel(page)
    .getByRole("button", { name: /買い物/ })
    .click();
  const sheet = page.getByRole("dialog", { name: "予定を直す" });
  await sheet.getByLabel("題名").fill("夕飯の買い出し");
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予定を保存しました")).toBeVisible();
  await expect(dayPanel(page).getByRole("button", { name: /夕飯の買い出し/ })).toBeVisible();
});

test("終日の予定は、終わりの日まで出る", async ({ page }) => {
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await sheet.getByLabel("題名").fill("旅行");
  await sheet.getByRole("switch", { name: "終日" }).click();
  const start = await sheet.getByLabel("始まりの日").inputValue();
  const end = new Date(`${start}T00:00:00`);
  end.setDate(end.getDate() + 1);
  const endKey = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  await sheet.getByLabel("終わりの日").fill(endKey);
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(dayPanel(page).getByRole("button", { name: /終日\s*旅行/ })).toBeVisible();
  await page.goto(`/?date=${endKey}`);
  await expect(dayPanel(page).getByRole("button", { name: /旅行/ })).toBeVisible();
});

test("消すと 5 秒だけ元に戻せる", async ({ page }) => {
  await addEvent(page, "ジム");
  const item = dayPanel(page).getByRole("button", { name: /ジム/ });
  await item.click();
  await page.getByRole("dialog", { name: "予定を直す" }).getByRole("button", { name: "予定を消す" }).click();
  await expect(item).toBeHidden();
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(item).toBeVisible();

  await item.click();
  await page.getByRole("dialog", { name: "予定を直す" }).getByRole("button", { name: "予定を消す" }).click();
  await expect(item).toBeHidden();
  // 5 秒たつと本当に消え、読み込み直しても出ない
  await page.waitForTimeout(6_000);
  await page.reload();
  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();
  await expect(dayPanel(page).getByRole("button", { name: /ジム/ })).toHaveCount(0);
});

test("日付を押すと、その日を選ぶだけになる。中身は日のカードに出る。#148", async ({ page }) => {
  const grid = page.getByRole("region", { name: "月の表" });
  await grid.locator('[data-date="15"]:not([data-out]) button').first().click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/date=\d{4}-\d{2}-15/);
  await expect(page.getByTestId("big-day")).toHaveText("15");
});

test("日付を選んでから下の帯の「+」を押すと、選んでいる日で予定を足すシートが開く。#148、issue #150", async ({
  page,
}) => {
  const grid = page.getByRole("region", { name: "月の表" });
  await grid.locator('[data-date="15"]:not([data-out]) button').first().click();

  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel("日付")).toHaveValue(/-15$/);
  // 予定が無い日は、一覧を出さない
  await expect(sheet.getByRole("region", { name: /日の予定$/ })).toHaveCount(0);
  await sheet.getByLabel("題名").fill("歯医者");
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予定を足しました")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // もう一度「+」を押すと、その日の予定が畳んだ 1 行で並ぶ。開くと押すと直すシートに切り替わる
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const list = sheet.getByRole("region", { name: /15日の予定$/ });
  await expect(list.getByRole("button", { name: /歯医者/ })).toHaveCount(0);
  await list.getByRole("button", { name: /15日の予定/ }).click();
  await expect(list.getByRole("button", { name: /歯医者/ })).toBeVisible();
  await expect(list.getByText("自分")).toBeVisible();
  await list.getByRole("button", { name: /歯医者/ }).click();
  const edit = page.getByRole("dialog", { name: "予定を直す" });
  await expect(edit).toBeVisible();
  await expect(edit.getByLabel("題名")).toHaveValue("歯医者");
  await expect(page.getByRole("dialog", { name: "新しい予定" })).toHaveCount(0);
});

test("新しい予定のシートを開くと、題名にフォーカスがある。issue #200", async ({ page }) => {
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await expect(sheet.getByLabel("題名")).toBeFocused();
});

test("題名を入れてからその日の予定の行を押すと確かめが出て、やめると書きかけが残る。issue #200", async ({ page }) => {
  await addEvent(page, "歯医者");

  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await sheet.getByLabel("題名").fill("買い物");
  const list = sheet.getByRole("region", { name: /日の予定$/ });
  // 畳んだ行を開いてから、既にある予定を押す
  await list.getByRole("button", { name: /日の予定/ }).click();
  await list.getByRole("button", { name: /歯医者/ }).click();

  const confirm = page.getByRole("dialog", { name: "書きかけを捨てて開きますか" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "やめる" }).click();
  await expect(confirm).toBeHidden();
  // シートは切り替わらず、書きかけの題名がそのまま残る
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel("題名")).toHaveValue("買い物");

  // もう一度押して、今度は「開く」を選ぶと直すシートに切り替わり、書きかけは消える
  await list.getByRole("button", { name: /歯医者/ }).click();
  await confirm.getByRole("button", { name: "開く" }).click();
  const edit = page.getByRole("dialog", { name: "予定を直す" });
  await expect(edit).toBeVisible();
  await expect(edit.getByLabel("題名")).toHaveValue("歯医者");
  await expect(sheet).toHaveCount(0);
});

test("長押しでも、押すのと同じくその日を選ぶだけになる。#148", async ({ page }) => {
  const cell = page.getByRole("region", { name: "月の表" }).locator('[data-date="12"]:not([data-out]) button').first();
  const box = (await cell.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/date=\d{4}-\d{2}-12/);
  await expect(page.getByTestId("big-day")).toHaveText("12");
});

test("今日には読み上げ用の印が付き、月を移ると今日のボタンが出る", async ({ page }) => {
  await expect(page.locator('[aria-current="date"]')).toHaveCount(1);
  await expect(page.getByRole("button", { name: "今日", exact: true })).toHaveCount(0);
  // 月末の数日は、次の月の表の先頭の週に今日が入る。2 か月先なら今日は表に出ない
  await page.getByRole("button", { name: "次の月" }).click();
  await expect(page.getByRole("button", { name: "今日", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "次の月" }).click();
  await expect(page.locator('[aria-current="date"]')).toHaveCount(0);
  await page.getByRole("button", { name: "今日", exact: true }).click();
  await expect(page.locator('[aria-current="date"]')).toHaveCount(1);
});

test("週と日の表示に切り替えられる", async ({ page }) => {
  await addEvent(page, "会議");
  await page.getByRole("radio", { name: "週" }).last().click();
  await expect(page.getByRole("region", { name: "週の予定" })).toBeVisible();
  await expect(page.getByRole("region", { name: "週の予定" }).getByTestId("week-row")).toHaveCount(7);
  await expect(page.getByRole("button", { name: /会議/ })).toBeVisible();
  await page.getByRole("radio", { name: "日" }).last().click();
  await expect(page.getByRole("region", { name: "日の予定" }).getByTestId("week-row")).toHaveCount(1);
});

test("祝日は名前が出る", async ({ page }) => {
  await page.goto("/?date=2026-09-21");
  await expect(dayPanel(page)).toContainText("敬老の日");
  await expect(dayPanel(page).locator("[data-tone]")).toHaveAttribute("data-tone", "sun");
});
