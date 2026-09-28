import { expect, test } from "@playwright/test";
import { addExtension, signUp, tokyoDateParts } from "./helpers";

/**
 * release/2026-w40 の撮り比べで見つけた崩れ 4 つ(logru#275)。新しい見た目・スマホで確かめる。
 * PC の 1 つ(「+」の白い帯)は visual-fixes.desktop.spec.ts。
 */

test("月の表の上の帯に、いまの月と前後の月へ移るボタンがある。月・週・日のどの表示でも出る", async ({ page }) => {
  await signUp(page);
  await page.goto("/?view=month");
  const now = tokyoDateParts();
  const nextMonth = (now.month % 12) + 1;

  await expect(page.getByTestId("nl-month-title")).toHaveText(`${now.month}月`);
  await expect(page.getByTestId("nl-month-bar")).toContainText(String(now.year));
  await page.getByRole("button", { name: "次の月" }).click();
  await expect(page.getByTestId("nl-month-title")).toHaveText(`${nextMonth}月`);
  await page.getByRole("button", { name: "前の月" }).click();
  await expect(page.getByTestId("nl-month-title")).toHaveText(`${now.month}月`);

  for (const view of ["week", "day"]) {
    await page.goto(`/?view=${view}`);
    await expect(page.getByTestId("nl-month-title")).toBeVisible();
    await expect(page.getByRole("button", { name: "前へ" })).toBeVisible();
    await expect(page.getByRole("button", { name: "次へ" })).toBeVisible();
  }
});

test("共有リストの詳細は、面の先頭が項目の行で、追加ボタンに「項目を足す」の文字がある", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await addExtension(page, "リスト");
  await page.goto("/lists?create=1");
  const create = page.getByRole("dialog", { name: "リストを作る" });
  await create.getByLabel("名前").fill("買い物");
  await create.getByRole("button", { name: "作る" }).click();
  await expect(page).toHaveURL(/\/lists\/.+/);

  // 項目が 0 のとき: 追加ボタンに文字がある
  const addButton = page.getByRole("button", { name: "項目を足す" });
  await expect(addButton).toBeVisible();
  await expect(addButton).toContainText("項目を足す");
  await addButton.click();
  await page.getByLabel("項目を足す").fill("にんじん");
  await page.getByLabel("項目を足す").press("Enter");
  await expect(page.getByRole("checkbox", { name: "にんじん をチェックする" })).toBeVisible();
  await expect(page.getByLabel("項目を足す")).toHaveValue("");
  await page.getByLabel("項目を足す").fill("牛乳");
  await page.getByLabel("項目を足す").press("Enter");
  await expect(page.getByRole("checkbox", { name: "牛乳 をチェックする" })).toBeVisible();

  // 面の先頭の行の上に、区切りの線が無い
  const firstRow = page.locator("ul > li", { has: page.getByRole("checkbox") }).first();
  await expect(firstRow).toBeVisible();
  await expect(firstRow).toHaveCSS("border-top-width", "0px");
  // 2 行目からは今までどおり線がある
  await expect(page.locator("ul > li", { has: page.getByRole("checkbox") }).nth(1)).not.toHaveCSS(
    "border-top-width",
    "0px",
  );
});

test("設定の見た目: 「写真を選ぶ」と「頭文字に戻す」が、アバターの右に縦にそろい、枠が見える", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await page.goto("/settings/appearance");
  const actions = page.getByTestId("avatar-actions");
  await expect(actions).toBeVisible();
  const avatar = actions.locator("xpath=preceding-sibling::*[1]");
  const [a, box] = [await avatar.boundingBox(), await actions.boundingBox()];
  const pick = await actions.getByRole("button", { name: "写真を選ぶ" }).boundingBox();
  const reset = await actions.getByRole("button", { name: "頭文字に戻す" }).boundingBox();
  if (!a || !box || !pick || !reset) throw new Error("四角が取れない");
  // アバターの右にある
  expect(box.x).toBeGreaterThanOrEqual(a.x + a.width);
  // 2 つのボタンは、左端と幅がそろい、縦に並ぶ
  expect(Math.abs(pick.x - reset.x)).toBeLessThan(1);
  expect(Math.abs(pick.width - reset.width)).toBeLessThan(1);
  expect(reset.y).toBeGreaterThan(pick.y + pick.height - 1);
  // 枠は、白い面に溶けない濃さ(白ではない)
  const border = await actions
    .getByRole("button", { name: "写真を選ぶ" })
    .evaluate((el) => getComputedStyle(el).borderTopColor);
  const [r, g, b, alpha = 1] = (border.match(/[\d.]+/g) ?? []).map(Number);
  expect(alpha).toBeGreaterThan(0.2);
  expect((r ?? 0) + (g ?? 0) + (b ?? 0)).toBeLessThan(600);
});
