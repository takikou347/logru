import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { addExtension, addMemories, signUp } from "./helpers";

// 写真は Unsplash License のフリー写真を小さくしたもの。出どころは develop-docs の docs/logru/extensions/memories/images/photos/sources.txt
const PHOTO = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/photo.jpg");

/** 機能の一覧で、思い出を自分だけで使えるようにする */
async function enableMemories(page: import("@playwright/test").Page) {
  await addExtension(page, "思い出");
}

test("足す前は、思い出の画面は開けない", async ({ page }) => {
  await signUp(page);
  await page.goto("/memories");
  await expect(page).toHaveURL(/\/settings\/extensions$/);
});

test("思い出を作り、写真付きで記録し、いいねを付け、カレンダーに出る", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableMemories(page);

  // 機能のシートに入口が出る。記録の動線はホームのウィジェットへ移した
  await page.goto("/");
  await page.getByRole("toolbar", { name: "カレンダーの操作" }).getByRole("button", { name: "機能" }).click();
  const sheet = page.getByRole("dialog", { name: "機能" });
  await expect(sheet.getByTestId("extension-tile-memories")).toBeVisible();
  await expect(sheet.getByRole("link", { name: /記録する/ })).toHaveCount(0);
  await sheet.getByRole("link", { name: /思い出/ }).click();

  // 今日の日帰りの思い出を作ると、その 1 日が開く
  await addMemories(page, "思い出を作る");
  const create = page.getByRole("dialog", { name: "思い出を作る" });
  await create.getByLabel("題名").fill("箱根 日帰り");
  await create.getByRole("button", { name: "作る" }).click();
  await expect(page.getByRole("heading", { name: "箱根 日帰り" })).toBeVisible();
  await expect(page).toHaveURL(/\/days\/0$/);

  // 写真を選ぶと送り始め、送り終えたら残せる
  await page.getByRole("toolbar", { name: "1 日の操作" }).getByRole("button", { name: "記録する" }).click();
  const record = page.getByRole("dialog", { name: "記録する" });
  await record.locator('input[type="file"][multiple]').setInputFiles(PHOTO);
  await expect(record.getByRole("button", { name: "保存する" })).toBeEnabled({ timeout: 15_000 });
  await record.getByLabel("文章").fill("湯本に着いた。まずは和菓子。");
  await record.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();

  const flow = page.getByRole("list", { name: "1 日の流れ" });
  const article = flow.getByRole("article", { name: "こた の記録" });
  await expect(article.getByText("湯本に着いた。まずは和菓子。")).toBeVisible();
  await expect(article.locator("img")).toHaveJSProperty("complete", true);

  // いいねを付けると 1、もう一度押すと 0
  await article.getByRole("button", { name: /いいねを付ける/ }).click();
  await expect(article.getByRole("button", { name: /いいねを外す。いま 1/ })).toBeVisible();
  await article.getByRole("button", { name: /いいねを外す/ }).click();
  await expect(article.getByRole("button", { name: /いいねを付ける。いま 0/ })).toBeVisible();

  // アルバムに写真が並び、押すと大きく出る
  await page.getByRole("radio", { name: "アルバム" }).click();
  await page
    .getByRole("button", { name: /の写真を大きく見る/ })
    .first()
    .click();
  await expect(page.getByRole("dialog", { name: "写真 1 / 1" })).toBeVisible();
  await page.getByRole("dialog", { name: "写真 1 / 1" }).getByRole("button", { name: "表紙にする" }).click();
  await expect(page.getByText("表紙にしました")).toBeVisible();

  // カレンダーに思い出の帯と、その日の記録の数が出る
  await page.goto("/");
  const day = page.getByTestId("day-panel");
  await expect(day.getByRole("button", { name: /箱根 日帰り/ })).toBeVisible();
  await expect(day.getByRole("button", { name: /記録 1/ })).toBeVisible();
});

test("しおりにやること、持ち物を足して済みにできる。思い出を消しても記録は残る", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableMemories(page);
  await page.goto("/memories");
  await addMemories(page, "思い出を作る");
  const create = page.getByRole("dialog", { name: "思い出を作る" });
  await create.getByLabel("題名").fill("金沢 2 泊");
  await create.getByRole("button", { name: "作る" }).click();

  await page.getByRole("radio", { name: "しおり" }).click();
  await page.getByRole("tab", { name: /やること/ }).click();
  await page.getByRole("button", { name: "やることを足す" }).click();
  await page.getByRole("textbox", { name: "やることを足す" }).fill("おでんの店を予約する");
  await page.getByRole("button", { name: "足す", exact: true }).click();
  const todo = page.getByRole("checkbox", { name: "おでんの店を予約する を完了にする" });
  await todo.click();
  await expect(todo).toBeChecked();

  await page.getByRole("tab", { name: /持ち物/ }).click();
  await page.getByRole("button", { name: "持ち物を足す" }).click();
  await page.getByRole("textbox", { name: "持ち物を足す" }).fill("充電器");
  await page.getByRole("button", { name: "足す", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "充電器 を完了にする" })).toBeVisible();

  // 消すと、確認は出ず 5 秒だけ「元に戻す」を出す。issue #12
  await page.getByRole("button", { name: "充電器 を消す" }).click();
  await expect(page.getByRole("checkbox", { name: "充電器 を完了にする" })).toBeHidden();
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.getByRole("checkbox", { name: "充電器 を完了にする" })).toBeVisible();

  // 文章だけの記録を残してから、思い出を消す
  await page.getByRole("radio", { name: "1 日" }).click();
  await page.getByRole("toolbar", { name: "1 日の操作" }).getByRole("button", { name: "記録する" }).click();
  await page.getByRole("dialog", { name: "記録する" }).getByLabel("文章").fill("出発");
  await page.getByRole("dialog", { name: "記録する" }).getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();

  await page.getByRole("button", { name: "思い出を編集" }).click();
  await page.getByRole("dialog", { name: "思い出を編集" }).getByRole("button", { name: "消す" }).click();
  await page.getByRole("dialog", { name: "思い出を消しますか" }).getByRole("button", { name: "消す" }).click();
  await expect(page).toHaveURL(/\/memories$/);
  await expect(page.getByRole("region", { name: "最近の記録" }).getByText("出発")).toBeVisible();
});

test("同じ写真を2回選んでも1回しか送らない。外すとすぐ消す要求を送る。#158", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableMemories(page);
  await page.goto("/memories");
  await addMemories(page, "思い出を作る");
  const create = page.getByRole("dialog", { name: "思い出を作る" });
  await create.getByLabel("題名").fill("テスト旅行");
  await create.getByRole("button", { name: "作る" }).click();
  await expect(page).toHaveURL(/\/days\/0$/);

  await page.getByRole("toolbar", { name: "1 日の操作" }).getByRole("button", { name: "記録する" }).click();
  const record = page.getByRole("dialog", { name: "記録する" });
  // 1 回の選択で同じ写真を 2 枚指定しても、送るのは 1 枚だけ。F-117、#158
  await record.locator('input[type="file"][multiple]').setInputFiles([PHOTO, PHOTO]);
  await expect(page.getByText("同じ写真は 1 回だけ選べます。")).toBeVisible();
  await expect(record.getByRole("listitem")).toHaveCount(1);
  await expect(record.getByRole("button", { name: "保存する" })).toBeEnabled({ timeout: 15_000 });

  // 送った写真を外すと、まだ記録に付いていないので、その場で消す要求を送る。#158
  const discard = page.waitForRequest(
    (req) => req.method() === "DELETE" && /\/api\/memories\/photos\/[^/]+$/.test(req.url()),
  );
  await record.getByRole("button", { name: /写真 1 を外す/ }).click();
  await discard;
  await expect(record.getByRole("listitem")).toHaveCount(0);
});
