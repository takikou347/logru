import { type Browser, expect, type Page, test } from "@playwright/test";
import { dayPanel, pickShare, signUp } from "./helpers";

/**
 * 「ふたり」のグループを作り、ほかの人を招待リンクで入れる。invitations.spec.ts と同じ作り方。
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

/** 下の操作から予定を足し、「ふたり」に置いて、names の人を招待する */
async function addInvited(page: Page, title: string, names: string[]) {
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await sheet.getByLabel("題名").fill(title);
  await pickShare(page, sheet, "ふたり");
  const picker = sheet.getByRole("group", { name: "招待する人" });
  for (const name of names) await picker.getByRole("button", { name, exact: true }).click();
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予定を足しました")).toBeVisible();
}

const dayItem = (page: Page, title: string) => dayPanel(page).getByRole("button", { name: new RegExp(title) });

async function openItem(page: Page, title: string) {
  await dayItem(page, title).click();
  return page.getByRole("dialog");
}

/** 見えているほうのベルを押す。スマホは上の帯、PC も上の帯にある */
function bellButton(page: Page) {
  return page.getByRole("button", { name: /お知らせ/ }).filter({ visible: true });
}

/** グループの設定で思い出を有効にする。groups.spec.ts と同じ、グループの詳細に入って切り替える作り方 */
async function enableMemoriesForGroup(page: Page, groupName: string) {
  await page.goto("/groups");
  await page.getByRole("link", { name: new RegExp(groupName) }).click();
  const toggle = page.getByRole("switch", { name: "思い出" });
  await toggle.click();
  await expect(toggle).toBeChecked();
}

/** 自分でも思い出を使うにする。グループで有効でも、これをしないと入口が出ない。0019 */
async function enableMemoriesForSelf(page: Page) {
  await page.goto("/settings/extensions");
  const toggle = page.getByRole("switch", { name: "思い出を使う" });
  // 自分だけのグループの ID を読み終えるまで、切り替えは disabled のまま
  await expect(toggle).toBeEnabled();
  await toggle.click();
  await expect(toggle).toBeChecked();
}

test("招待に参加すると招待した人にお知らせが出る。押すと予定が開き、既読になる。#32", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const [mika] = await shareGroup(page, browser, ["みか"]);
  await addInvited(page, "花火大会", ["みか"]);

  // 参加する前は、まだお知らせは無い
  await expect(bellButton(page)).toHaveAccessibleName("お知らせ");

  // 招待されたみかが「参加する」を返す
  await mika!.reload();
  const invited = await openItem(mika!, "花火大会");
  await invited.getByRole("region", { name: "招待への返事" }).getByRole("button", { name: "参加する" }).click();
  await expect(mika!.getByText("参加すると返しました")).toBeVisible();
  await mika!.keyboard.press("Escape");

  // 作った人のベルに未読が 1 件付く
  await page.reload();
  await expect(bellButton(page)).toHaveAccessibleName("お知らせ。未読 1 件");

  // 開くと一覧に出て、押すと既読になり、その予定のシートが開く
  await bellButton(page).click();
  const list = page.getByRole("dialog", { name: "お知らせ" });
  await expect(list).toBeVisible();
  const row = list.getByRole("button", { name: /花火大会.*参加が決まりました/ });
  await expect(row).toBeVisible();
  await row.click();

  const opened = page.getByRole("dialog", { name: "予定を直す" });
  await expect(opened).toBeVisible();
  await expect(opened.getByLabel("題名")).toHaveValue("花火大会");
  await page.keyboard.press("Escape");
  await expect(opened).toHaveCount(0);

  // 既読になったので、ベルの未読は消える
  await expect(bellButton(page)).toHaveAccessibleName("お知らせ");
  await bellButton(page).click();
  await expect(page.getByRole("dialog", { name: "お知らせ" }).getByText("花火大会", { exact: false })).toBeVisible();
});

test("参加しないを経ての参加し直しは知らせるが、不参加そのものは知らせない。#32", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const [mika] = await shareGroup(page, browser, ["みか"]);
  await addInvited(page, "花火大会", ["みか"]);

  await mika!.reload();
  const sheet = await openItem(mika!, "花火大会");
  const rsvp = sheet.getByRole("region", { name: "招待への返事" });

  // 参加する。前の答えが「参加する」ではないので知らせる(1 件目)
  await rsvp.getByRole("button", { name: "参加する" }).click();
  await expect(mika!.getByText("参加すると返しました")).toBeVisible();

  // 参加しないに変える。作った人には届かない
  await rsvp.getByRole("button", { name: "参加しない" }).click();
  await expect(mika!.getByText("参加しないと返しました")).toBeVisible();

  // もう一度参加する。前の答えは「参加しない」で「参加する」ではないので、これも新しい変化として知らせる(2 件目)
  await rsvp.getByRole("button", { name: "参加する" }).click();
  await expect(mika!.getByText("参加すると返しました")).toBeVisible();

  await page.reload();
  await expect(bellButton(page)).toHaveAccessibleName("お知らせ。未読 2 件");
});

test("いいねを外して付け直しても、お知らせは 1 件のまま。F-116、#32", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const [mika] = await shareGroup(page, browser, ["みか"]);
  // 共有のグループで有効にした人(こた)は、それだけで自分でも使うとみなされる。0019
  await enableMemoriesForGroup(page, "ふたり");
  await enableMemoriesForSelf(mika!);

  // こたが思い出を作り、記録する
  await page.goto("/memories");
  await page.getByRole("button", { name: "思い出を作る" }).click();
  const create = page.getByRole("dialog", { name: "思い出を作る" });
  await create.getByLabel("題名").fill("箱根 日帰り");
  await create.getByRole("button", { name: "作る" }).click();
  await expect(page.getByRole("heading", { name: "箱根 日帰り" })).toBeVisible();

  await page.getByRole("toolbar", { name: "1 日の操作" }).getByRole("button", { name: "記録する" }).click();
  const record = page.getByRole("dialog", { name: "記録する" });
  await record.getByLabel("文章").fill("湯本に着いた。");
  await record.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();

  // みかが同じ日を開き、いいねを付ける、外す、付け直す
  await mika!.goto("/memories");
  const memoryLink = mika!.getByRole("link", { name: /箱根 日帰り/ });
  await expect(memoryLink).toBeVisible();
  await memoryLink.click();
  const flow = mika!.getByRole("list", { name: "1 日の流れ" });
  const article = flow.getByRole("article", { name: "こた の記録" });
  await article.getByRole("button", { name: /いいねを付ける/ }).click();
  await expect(article.getByRole("button", { name: /いいねを外す/ })).toBeVisible();
  await article.getByRole("button", { name: /いいねを外す/ }).click();
  await expect(article.getByRole("button", { name: /いいねを付ける/ })).toBeVisible();
  await article.getByRole("button", { name: /いいねを付ける/ }).click();
  await expect(article.getByRole("button", { name: /いいねを外す/ })).toBeVisible();

  // 外して付け直しても、こたに届くお知らせは 1 件のまま。ベルはカレンダーの帯にだけある
  await page.goto("/");
  await expect(bellButton(page)).toHaveAccessibleName("お知らせ。未読 1 件");
  await bellButton(page).click();
  const list = page.getByRole("dialog", { name: "お知らせ" });
  await expect(list.getByRole("button", { name: /いいねが付きました/ })).toHaveCount(1);
});
