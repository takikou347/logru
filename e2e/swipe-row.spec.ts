import { expect, test } from "@playwright/test";
import { addExtension, signUp, swipeRowLeft, touchDrag } from "./helpers";

/**
 * 共有リストの項目行で、SwipeRow(共通部品、0084、#225)の指の動きを確かめる。
 * スマホの幅で、指の Pointer Events(CDP の touch)を使う。
 */
test.use({ viewport: { width: 390, height: 844 } });

test("項目を左へ引くと「直す」「消す」が出る。「直す」で入力に変わり、保存できる", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await addExtension(page, "リスト");
  await page.goto("/lists");
  await page.getByRole("toolbar", { name: "リストの操作" }).getByRole("button", { name: "リストを作る" }).click();
  await page.getByRole("dialog", { name: "リストを作る" }).getByLabel("名前").fill("買い物");
  await page.getByRole("dialog", { name: "リストを作る" }).getByRole("button", { name: "作る" }).click();
  await expect(page).toHaveURL(/\/lists\/.+/);

  const addInput = page.getByLabel("項目を足す");
  await addInput.fill("にんじん");
  await addInput.press("Enter");
  await expect(page.getByText("にんじん")).toBeVisible();

  const row = page.getByTestId("swipe-row").filter({ hasText: "にんじん" });
  await expect(row.getByRole("button", { name: "直す", exact: true })).toHaveCount(1);
  await expect(row.getByRole("button", { name: "消す", exact: true })).toHaveCount(1);

  // 閉じている間は、直す・消すのボタンは表に出ない
  await expect(row).not.toHaveAttribute("data-swipe-open", "true");

  await swipeRowLeft(page, row, 120);
  await expect(row).toHaveAttribute("data-swipe-open", "true");
  await expect(row.getByRole("button", { name: "直す", exact: true })).toBeVisible();
  await expect(row.getByRole("button", { name: "消す", exact: true })).toBeVisible();

  await row.getByRole("button", { name: "直す", exact: true }).click();
  const editInput = page.getByLabel("にんじん を直す");
  await expect(editInput).toBeFocused();
  await editInput.fill("大根");
  await editInput.press("Enter");
  await expect(page.getByText("大根")).toBeVisible();
  await expect(page.getByText("にんじん")).toHaveCount(0);
});

test("半分より浅く引くと閉じ、半分を超えると開いたままになる", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await addExtension(page, "リスト");
  await page.goto("/lists");
  await page.getByRole("toolbar", { name: "リストの操作" }).getByRole("button", { name: "リストを作る" }).click();
  await page.getByRole("dialog", { name: "リストを作る" }).getByLabel("名前").fill("買い物");
  await page.getByRole("dialog", { name: "リストを作る" }).getByRole("button", { name: "作る" }).click();
  await expect(page).toHaveURL(/\/lists\/.+/);

  const addInput = page.getByLabel("項目を足す");
  await addInput.fill("にんじん");
  await addInput.press("Enter");
  await expect(page.getByText("にんじん")).toBeVisible();

  const row = page.getByTestId("swipe-row").filter({ hasText: "にんじん" });

  // ボタン 2 つ分の幅の半分にも届かない小さな動きでは、離すと閉じる
  await swipeRowLeft(page, row, 20);
  await expect(row).not.toHaveAttribute("data-swipe-open", "true");

  // 半分を超える動きでは、離しても開いたまま残る。ボタン 2 つ分(144px)の半分(72px)に余裕を持たせる
  await swipeRowLeft(page, row, 120);
  await expect(row).toHaveAttribute("data-swipe-open", "true");
});

test("行の幅の 6 割ほど引き切ると、そのまま消える。5 秒だけ元に戻せる", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await addExtension(page, "リスト");
  await page.goto("/lists");
  await page.getByRole("toolbar", { name: "リストの操作" }).getByRole("button", { name: "リストを作る" }).click();
  await page.getByRole("dialog", { name: "リストを作る" }).getByLabel("名前").fill("買い物");
  await page.getByRole("dialog", { name: "リストを作る" }).getByRole("button", { name: "作る" }).click();
  await expect(page).toHaveURL(/\/lists\/.+/);

  const addInput = page.getByLabel("項目を足す");
  await addInput.fill("にんじん");
  await addInput.press("Enter");
  await expect(page.getByText("にんじん")).toBeVisible();

  const row = page.getByTestId("swipe-row").filter({ hasText: "にんじん" });
  const box = await row.boundingBox();
  if (!box) throw new Error("行の位置が取れなかった");
  await swipeRowLeft(page, row, box.width * 0.7);

  await expect(page.getByText("にんじん")).toBeHidden();
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeVisible();
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.getByText("にんじん")).toBeVisible();
});

test("縦にスクロールしても、行は横に動かない", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await addExtension(page, "リスト");
  await page.goto("/lists");
  await page.getByRole("toolbar", { name: "リストの操作" }).getByRole("button", { name: "リストを作る" }).click();
  await page.getByRole("dialog", { name: "リストを作る" }).getByLabel("名前").fill("買い物");
  await page.getByRole("dialog", { name: "リストを作る" }).getByRole("button", { name: "作る" }).click();
  await expect(page).toHaveURL(/\/lists\/.+/);

  const addInput = page.getByLabel("項目を足す");
  await addInput.fill("にんじん");
  await addInput.press("Enter");
  await expect(page.getByText("にんじん")).toBeVisible();

  const row = page.getByTestId("swipe-row").filter({ hasText: "にんじん" });
  const content = row.getByTestId("swipe-row-content");
  const before = await content.evaluate((el) => getComputedStyle(el).transform);

  const box = await row.boundingBox();
  if (!box) throw new Error("行の位置が取れなかった");
  // 横にはほぼ動かさず、縦にだけ大きく引く
  await touchDrag(
    page,
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    { x: box.x + box.width / 2 - 4, y: box.y - 300 },
  );

  const after = await content.evaluate((el) => getComputedStyle(el).transform);
  expect(after).toBe(before);
  await expect(row).not.toHaveAttribute("data-swipe-open", "true");
});
