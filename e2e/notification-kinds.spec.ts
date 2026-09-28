import { type Browser, expect, type Page, test } from "@playwright/test";
import { addEventButton, addExtension, enableOldLook, pickShare, signUp } from "./helpers";

/**
 * 「ふたり」のグループを作り、ほかの人を招待リンクで入れる。notifications.spec.ts と同じ作り方。issue #244〜#247
 * @returns 入った人の画面。names の順
 */
async function shareGroup(page: Page, browser: Browser, names: string[]) {
  await signUp(page, { name: "こた" });
  await page.goto("/groups");
  await page.getByLabel("グループの名前").fill("ふたり");
  await page.getByRole("button", { name: "作る" }).click();
  await page.getByRole("button", { name: "招待リンクを作る" }).click();
  const path = new URL(await page.getByLabel("招待リンク").inputValue()).pathname;
  const others: Page[] = [];
  for (const name of names) {
    const other = await (await browser.newContext()).newPage();
    await signUp(other, { name, next: path });
    await other.getByRole("button", { name: "参加する" }).click();
    await expect(other).toHaveURL(/group=/);
    await other.goto("/");
    others.push(other);
  }
  await page.goto("/");
  return others;
}

/** グループの設定で、その機能をこのグループに足す。groups.spec.ts と同じ作り方 */
async function enableForGroup(page: Page, groupName: string, extensionLabel: string) {
  await page.goto("/groups");
  await page.getByRole("link", { name: new RegExp(groupName) }).click();
  await page.getByRole("button", { name: `${extensionLabel}を足す` }).click();
  await expect(page.getByRole("button", { name: `${extensionLabel}を外す` })).toBeVisible();
}

/** 見えているほうのベルを押す */
function bellButton(page: Page) {
  return page.getByRole("button", { name: /お知らせ/ }).filter({ visible: true });
}

test("共有リストに項目を足すと、ほかのメンバーのお知らせにまとまって出る。押すとそのリストが開く。issue #247", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const [mika] = await shareGroup(page, browser, ["みか"]);
  await enableForGroup(page, "ふたり", "リスト");
  // 共有のグループで有効にした人(こた)は自分でも使うとみなされる。みかは自分でも足す。0019
  await addExtension(mika!, "リスト");

  // こたが「ふたり」でリストを作り、項目を 2 つ足す。リストの Dock は新しい見た目・スマホでは
  // 下のタブの帯に役目を移して隠れる(0091)ため、前の見た目に戻して確かめる
  await enableOldLook(page);
  await page.goto("/lists");
  await page.getByRole("toolbar", { name: "リストの操作" }).getByRole("button", { name: "リストを作る" }).click();
  const create = page.getByRole("dialog", { name: "リストを作る" });
  await create.getByLabel("名前").fill("買い物");
  await pickShare(page, create, "ふたり");
  await create.getByRole("button", { name: "作る" }).click();
  await expect(page).toHaveURL(/\/lists\/.+/);
  const addInput = page.getByLabel("項目を足す");
  await addInput.fill("にんじん");
  await addInput.press("Enter");
  await expect(page.getByText("にんじん")).toBeVisible();
  await addInput.fill("たまねぎ");
  await addInput.press("Enter");
  await expect(page.getByText("たまねぎ")).toBeVisible();

  // みかのベルに未読が付く。ほかに「機能が足された」の 1 件もあるので、リストの行だけを見る
  await mika!.goto("/");
  await expect(bellButton(mika!)).not.toHaveAccessibleName("お知らせ");
  await bellButton(mika!).click();
  const list = mika!.getByRole("dialog", { name: "お知らせ" });
  const row = list.getByRole("button", { name: /買い物.*2 件足しました/ });
  // にんじん・たまねぎの 2 件が、1 行にまとまっている。0096
  await expect(row).toHaveCount(1);

  // 押すと、そのリストが開く
  await row.click();
  await expect(mika!).toHaveURL(/\/lists\/.+/);
  await expect(mika!.getByRole("heading", { name: "買い物" })).toBeVisible();
});

test("種類ごとの設定で一覧を止めると、その種類のお知らせは積まれない。issue #244", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const [mika] = await shareGroup(page, browser, ["みか"]);
  await enableForGroup(page, "ふたり", "リスト");
  await addExtension(mika!, "リスト");

  // みかが設定で「リストに項目が足された」の一覧を止める
  await mika!.goto("/settings/notifications");
  const toggle = mika!.getByRole("switch", { name: "リストに項目が足されたを一覧に出す" });
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();

  // こたが「ふたり」でリストを作り、項目を足す。リストの Dock は新しい見た目・スマホでは
  // 下のタブの帯に役目を移して隠れる(0091)ため、前の見た目に戻して確かめる
  await enableOldLook(page);
  await page.goto("/lists");
  await page.getByRole("toolbar", { name: "リストの操作" }).getByRole("button", { name: "リストを作る" }).click();
  const create = page.getByRole("dialog", { name: "リストを作る" });
  await create.getByLabel("名前").fill("持ち物");
  await pickShare(page, create, "ふたり");
  await create.getByRole("button", { name: "作る" }).click();
  await expect(page).toHaveURL(/\/lists\/.+/);
  await page.getByLabel("項目を足す").fill("タオル");
  await page.getByLabel("項目を足す").press("Enter");
  await expect(page.getByText("タオル")).toBeVisible();

  // 止めた種類なので、みかのベルに未読は付かない
  await mika!.goto("/");
  await expect(bellButton(mika!)).toHaveAccessibleName("お知らせ");
});

test("家計簿で立て替えると、負担する人のお知らせに金額と負担額が出る。押すとその記録が開く。issue #246", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const [mika] = await shareGroup(page, browser, ["みか"]);
  await enableForGroup(page, "ふたり", "家計簿");
  await addExtension(mika!, "家計簿");

  // こたが「ふたり」で支出を記録する。口座を選ばないので、こたとみかで均等に割る。家計簿の Dock は
  // 新しい見た目・スマホでは下のタブの帯に役目を移して隠れる(0091)ため、前の見た目に戻して確かめる
  await enableOldLook(page);
  await page.goto("/kakeibo");
  await page.getByRole("toolbar", { name: "家計簿の操作" }).getByRole("button", { name: "支出を記録する" }).click();
  const sheet = page.getByRole("dialog", { name: "記録する" });
  await sheet.getByLabel("金額").fill("2000");
  await sheet.getByRole("radio", { name: "食費" }).click();
  await pickShare(page, sheet, "ふたり");
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();

  // みかのベルに、金額と自分の負担額を入れた文言で出る
  await mika!.goto("/");
  await expect(bellButton(mika!)).not.toHaveAccessibleName("お知らせ");
  await bellButton(mika!).click();
  const list = mika!.getByRole("dialog", { name: "お知らせ" });
  const row = list.getByRole("button", { name: /こたが.*¥2,000.*立て替えました。あなたの負担 ¥1,000/ });
  await expect(row).toBeVisible();

  // 押すと、家計簿の画面がその記録を直すシートを開いた状態で開く
  await row.click();
  await expect(mika!).toHaveURL(/\/kakeibo\?/);
  await expect(mika!.getByRole("dialog", { name: "記録を直す" })).toBeVisible();
  await expect(mika!.getByRole("dialog", { name: "記録を直す" }).getByLabel("金額")).toHaveValue("2000");
});

test("共有の予定を足すと、ほかのメンバーのお知らせに出る。issue #245", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const [mika] = await shareGroup(page, browser, ["みか"]);

  // こたが「ふたり」で予定を足す。招待はしない
  await page.goto("/");
  await addEventButton(page);
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await sheet.getByLabel("題名").fill("花火大会");
  await pickShare(page, sheet, "ふたり");
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予定を足しました")).toBeVisible();

  // みかのベルに出る。押すとその予定が開く
  await mika!.goto("/");
  await expect(bellButton(mika!)).not.toHaveAccessibleName("お知らせ");
  await bellButton(mika!).click();
  const list = mika!.getByRole("dialog", { name: "お知らせ" });
  const row = list.getByRole("button", { name: /花火大会.*予定に足されました/ });
  await expect(row).toBeVisible();
  await row.click();
  // みかは招待されていない、グループのメンバー。見るだけの予定として開く
  const opened = mika!.getByRole("dialog", { name: "予定" });
  await expect(opened).toBeVisible();
  await expect(opened.getByLabel("題名")).toHaveValue("花火大会");
});
