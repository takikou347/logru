import { type Browser, expect, type Page, test } from "@playwright/test";
import { dayPanel, signUp } from "./helpers";

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
  await sheet.getByRole("radio", { name: "ふたり" }).click();
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
