import { type Browser, expect, test } from "@playwright/test";
import { addEvent, apiUser, dayPanel, PASSWORD, signUp } from "./helpers";

async function newUser(browser: Browser, next?: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const user = await signUp(page, { name: "みか", next });
  if (next) await expect(page).toHaveURL(new RegExp(next));
  return { context, page, ...user };
}

test("招待したパートナーと、グループの予定を見合える", async ({ page, context, browser }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await signUp(page, { name: "こた" });

  // グループを作って招待リンクを出す
  await page.goto("/groups");
  await page.getByLabel("グループの名前").fill("ふたり");
  await page.getByRole("button", { name: "作る" }).click();
  await expect(page.getByRole("heading", { name: "ふたり" })).toBeVisible();
  await page.getByRole("button", { name: "招待リンクを作る" }).click();
  const url = await page.getByLabel("招待リンク").inputValue();
  expect(url).toMatch(/\/invite\//);
  const path = new URL(url).pathname;

  // 招待の欄のボタンはコピーだけ。押すとリンクがコピーされる
  const invite = page.getByRole("region", { name: "招待", exact: true });
  await expect(invite.getByRole("button", { name: "送る" })).toHaveCount(0);
  await invite.getByRole("button", { name: "コピーする" }).click();
  await expect(page.getByText("招待リンクをコピーしました")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);

  // 相手はリンクから登録して参加する
  const partner = await newUser(browser, path);
  await expect(partner.page.getByRole("heading", { name: "「ふたり」への招待" })).toBeVisible();
  await partner.page.getByRole("button", { name: "参加する" }).click();
  await expect(partner.page).toHaveURL(/group=/);

  // こた がグループの予定を足すと、みか にも見える
  await page.goto("/");
  await addEvent(page, "ふたりで夕飯", "ふたり");
  await partner.page.reload();
  await expect(dayPanel(partner.page).getByRole("button", { name: /ふたりで夕飯/ })).toBeVisible();

  // 「共有しない」のまま保存した予定は、相手には見えない
  await addEvent(page, "自分の用事");
  await expect(dayPanel(page).getByRole("button", { name: /自分の用事/ })).toBeVisible();
  await partner.page.reload();
  await expect(partner.page.getByText("自分の用事")).toHaveCount(0);

  // グループで絞ると、そのグループの予定だけになる
  await page.getByRole("navigation", { name: "グループで絞る" }).getByRole("button", { name: "ふたり" }).click();
  await expect(dayPanel(page).getByRole("button", { name: /ふたりで夕飯/ })).toBeVisible();
  await expect(dayPanel(page).getByRole("button", { name: /自分の用事/ })).toHaveCount(0);

  await partner.context.close();
});

test("グループの一覧に自分だけのグループは出ず、直接開いても一覧へ戻る", async ({ page }) => {
  await signUp(page);
  // 自分だけのグループの ID は、絞り込みの URL から分かる
  await page
    .getByRole("navigation", { name: "グループで絞る" })
    .getByRole("button", { name: "自分だけの予定" })
    .click();
  await expect(page).toHaveURL(/group=/);
  const personalId = new URL(page.url()).searchParams.get("group")!;

  await page.goto("/groups");
  const list = page.getByRole("region", { name: "グループの一覧" });
  await expect(list.getByText("まだ入っているグループはありません。")).toBeVisible();
  await expect(list.getByRole("link")).toHaveCount(0);

  await page.goto(`/groups/${personalId}`);
  await expect(page).toHaveURL(/\/groups$/);

  await page.getByLabel("グループの名前").fill("ふたり");
  await page.getByRole("button", { name: "作る" }).click();
  await expect(page.getByRole("heading", { name: "ふたり" })).toBeVisible();
  await page.goto("/groups");
  await expect(list.getByRole("link")).toHaveCount(1);
  await expect(list.getByRole("link", { name: /ふたり/ })).toBeVisible();
  await expect(list.getByText("自分", { exact: true })).toHaveCount(0);
});

test("最後の管理者は抜けられず、退会もできない。管理者を渡せば抜けられる", async ({ page, browser }) => {
  await signUp(page, { name: "こた" });
  await page.goto("/groups");
  await page.getByLabel("グループの名前").fill("実家");
  await page.getByRole("button", { name: "作る" }).click();
  await page.getByRole("button", { name: "招待リンクを作る" }).click();
  const path = new URL(await page.getByLabel("招待リンク").inputValue()).pathname;
  const groupUrl = page.url();

  const partner = await newUser(browser, path);
  await partner.page.getByRole("button", { name: "参加する" }).click();
  await expect(partner.page).toHaveURL(/group=/);

  // 退会しようとすると断られる
  await page.goto("/settings");
  await page.getByRole("button", { name: "アカウントを消す" }).click();
  const del = page.getByRole("dialog", { name: "アカウントを消す" });
  await expect(del.getByText(/ほかに管理者がいないグループがあります。.*実家/)).toBeVisible();
  await del.getByLabel(/削除する/).fill("削除する");
  await del.getByLabel("パスワード", { exact: true }).fill(PASSWORD);
  await expect(del.getByRole("button", { name: "アカウントを消す" })).toBeDisabled();
  await del.getByRole("button", { name: "やめる" }).click();

  // 抜けようとしても断られる
  await page.goto(groupUrl);
  await page.getByRole("button", { name: "グループを抜ける" }).click();
  await page.getByRole("dialog", { name: "グループを抜けますか" }).getByRole("button", { name: "抜ける" }).click();
  await expect(page.getByText("ほかに管理者がいません。先にほかの人を管理者にしてください。")).toBeVisible();

  // 管理者を渡すと抜けられる
  await page.reload();
  await page.getByRole("button", { name: "管理者にする" }).click();
  await expect(page.getByText("みか を管理者にしました")).toBeVisible();
  await page.getByRole("button", { name: "グループを抜ける" }).click();
  await page.getByRole("dialog", { name: "グループを抜けますか" }).getByRole("button", { name: "抜ける" }).click();
  await expect(page).toHaveURL(/\/groups$/);
  await expect(page.getByRole("region", { name: "グループの一覧" }).getByText("実家")).toHaveCount(0);

  await partner.context.close();
});

test("招待リンクを取り消すと、使えなくなる", async ({ page, browser }) => {
  await signUp(page);
  await page.goto("/groups");
  await page.getByLabel("グループの名前").fill("友だち");
  await page.getByRole("button", { name: "作る" }).click();
  await page.getByRole("button", { name: "招待リンクを作る" }).click();
  const path = new URL(await page.getByLabel("招待リンク").inputValue()).pathname;
  await page.getByRole("button", { name: "招待リンクをすべて取り消す" }).click();
  await expect(page.getByText("招待リンクをすべて取り消しました")).toBeVisible();

  const context = await browser.newContext();
  const other = await context.newPage();
  await other.goto(path);
  await expect(other.getByRole("heading", { name: "招待リンクを使えません" })).toBeVisible();
  await context.close();
});

test("ほかの人のグループの予定は読めない", async ({ page, request }) => {
  await signUp(page);
  await page.goto("/groups");
  await page.getByLabel("グループの名前").fill("秘密");
  await page.getByRole("button", { name: "作る" }).click();
  await expect(page.getByRole("heading", { name: "秘密" })).toBeVisible();
  const groupId = page.url().split("/").pop()!;

  const stranger = await apiUser(request);
  await request.post("/api/me/agreements", { headers: stranger.headers, data: { agreed: true } });
  const res = await request.post("/api/events", {
    headers: stranger.headers,
    data: { groupId, title: "のぞき", allDay: false, startsAt: Date.now(), endsAt: null, memo: null },
  });
  expect(res.status()).toBe(404);
  const list = await request.get(`/api/calendar?from=${Date.now() - 1e8}&to=${Date.now() + 1e8}&group=${groupId}`, {
    headers: stranger.headers,
  });
  expect((await list.json()).items).toEqual([]);
});
