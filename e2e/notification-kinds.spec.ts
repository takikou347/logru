import { type Browser, expect, type Page, test } from "@playwright/test";
import { addExtension, pickShare, signUp } from "./helpers";

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

  // こたが「ふたり」でリストを作り、項目を 2 つ足す
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

  // こたが「ふたり」でリストを作り、項目を足す
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
