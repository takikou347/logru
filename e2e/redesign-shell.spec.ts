import { expect, test } from "@playwright/test";
import { addExtension, enableOldLook, signUp } from "./helpers";

/**
 * 刷新 2。骨組み(上の帯、週の帯、下のタブ、「+」の放射)とアイコンだけの操作。0091、issue #239
 *
 * 新しい見た目は既定で出る。ラボの「前の見た目に戻す」を入れた人だけ、下のタブの帯は出ず、
 * 今までの Dock がそのまま動く。
 */

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("前の見た目に戻すを入れた人には、下のタブの帯が出ない", async ({ page }) => {
  await enableOldLook(page);
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "下のタブ" })).toBeHidden();
  // 今までの Dock(カレンダーの操作)はそのまま動く
  await expect(page.getByRole("toolbar", { name: "カレンダーの操作" })).toBeVisible();
});

test("新しい見た目は既定で、下のタブが 5 つアイコンだけで並ぶ。読み上げの名前は残る", async ({ page }) => {
  await page.goto("/");

  const tabs = page.getByRole("navigation", { name: "下のタブ" });
  await expect(tabs).toBeVisible();
  // 今までの Dock は隠れる。役目を下のタブの帯が引き継ぐ。issue #239
  await expect(page.getByRole("toolbar", { name: "カレンダーの操作" })).toBeHidden();

  await expect(tabs.getByRole("link", { name: "今日のページ" })).toBeVisible();
  await expect(tabs.getByRole("link", { name: "カレンダー" })).toBeVisible();
  await expect(tabs.getByRole("button", { name: "記録する" })).toBeVisible();
  await expect(tabs.getByRole("link", { name: "機能" })).toBeVisible();
  await expect(tabs.getByRole("link", { name: "設定" })).toBeVisible();

  // アイコンだけ。名前を常に出す文字は無い
  await expect(tabs.getByTestId("tab-hint")).toHaveCount(0);
});

test("下のタブはいつもアイコンだけで、開いた回数によらず名前の文字は出ない。押せる高さは 44px", async ({ page }) => {
  const tabs = page.getByRole("navigation", { name: "下のタブ" });
  // 1 回目も、開き直した何回目も同じ。アイコンの下に名前は出ない(kota の判断、2026-09-29)
  for (let i = 0; i < 4; i++) {
    await page.goto("/");
    await expect(tabs).toBeVisible();
    await expect(tabs.getByTestId("tab-hint")).toHaveCount(0);
    // 名前の文字を持つ要素は無く、読み上げの名前だけがある
    await expect(tabs.locator("small")).toHaveCount(0);
    await expect(tabs.getByRole("link", { name: "設定" })).toBeVisible();
  }
  for (const name of ["今日のページ", "カレンダー", "機能", "設定"]) {
    const box = (await tabs.getByRole("link", { name }).boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  expect((await tabs.getByRole("button", { name: "記録する" }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test("長押しで名前が出て、離しても操作はしない", async ({ page }) => {
  await page.goto("/");

  const tabs = page.getByRole("navigation", { name: "下のタブ" });
  const settingsTab = tabs.getByRole("link", { name: "設定" });
  const box = await settingsTab.boundingBox();
  if (!box) throw new Error("設定タブが見つかりません");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(tabs.getByTestId("long-press-label")).toHaveText("設定");
  await page.mouse.up();

  // 長押しから離しただけなので、設定には移らない
  await expect(page).toHaveURL("/");
  await expect(tabs.getByTestId("long-press-label")).toHaveCount(0);
});

test("「機能」「設定」タブで、それぞれの画面へ移る", async ({ page }) => {
  const tabs = page.getByRole("navigation", { name: "下のタブ" });
  await tabs.getByRole("link", { name: "機能" }).click();
  await expect(page).toHaveURL("/settings/extensions");

  await page.goto("/");
  await tabs.getByRole("link", { name: "設定" }).click();
  await expect(page).toHaveURL("/settings");
});

test("下のタブは、設定の下の画面でも「機能」と「設定」のどちらか 1 つだけが選ばれた色になる。issue #243", async ({
  page,
}) => {
  const tabs = page.getByRole("navigation", { name: "下のタブ" });

  // 「機能」(/settings/extensions)の道順は「設定」(/settings)から始まるが、選ばれるのは「機能」だけ
  await page.goto("/settings/extensions");
  await expect(tabs.getByRole("link", { name: "機能" })).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("link", { name: "設定" })).not.toHaveAttribute("aria-current", "page");

  // それ以外の設定の下の画面(見た目など)は「設定」が選ばれる
  await page.goto("/settings/appearance");
  await expect(tabs.getByRole("link", { name: "設定" })).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("link", { name: "機能" })).not.toHaveAttribute("aria-current", "page");
});

test("「+」は足している機能ぶんの記録の種類を出す。どの画面から押しても同じで、予定だけなら直接開く", async ({
  page,
}) => {
  // 設定の画面から押しても、カレンダーの画面から押しても同じ(いま開いている画面の addables ではない)。issue #239
  await page.goto("/settings");
  const tabs = page.getByRole("navigation", { name: "下のタブ" });
  await tabs.getByRole("button", { name: "記録する" }).click();
  await expect(page.getByRole("dialog", { name: "新しい予定" })).toBeVisible();
});

test("家計簿を足すと「+」に支出・収入が並び、放射から収入を選ぶと収入が選ばれた状態で開く", async ({ page }) => {
  await addExtension(page, "家計簿");
  await page.goto("/");
  const tabs = page.getByRole("navigation", { name: "下のタブ" });
  // 3 種類以上になったので、放射(弧)で出る。弧と幕は document.body へ portal で出るので、
  // 下のタブの帯(tabs)の外にある。page から探す。issue #239
  await tabs.getByRole("button", { name: "記録する" }).click();
  await expect(page.getByRole("button", { name: "予定を足す" })).toBeVisible();
  await expect(page.getByRole("button", { name: "支出を記録する" })).toBeVisible();
  await page.getByRole("button", { name: "収入を記録する" }).click();

  const sheet = page.getByRole("dialog", { name: "記録する" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("radio", { name: "収入", checked: true })).toBeVisible();
});

test("「+」を開くと、幕が画面全体を覆う(下のタブの帯の中に閉じ込められない)", async ({ page }) => {
  await addExtension(page, "家計簿");
  await page.goto("/");
  const tabs = page.getByRole("navigation", { name: "下のタブ" });
  await tabs.getByRole("button", { name: "記録する" }).click();

  const scrim = page.getByTestId("radial-scrim");
  await expect(scrim).toBeVisible();
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("viewport が取れません");
  await expect(async () => {
    const box = await scrim.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThanOrEqual(viewport.width - 1);
    expect(box!.height).toBeGreaterThanOrEqual(viewport.height - 1);
  }).toPass({ timeout: 5_000 });
});

test("家計簿のよく使う記録があると、「+」の上にカードで並び、押すとその記録が入った状態で開く", async ({ page }) => {
  await addExtension(page, "家計簿");
  // よく使う記録を 1 つ作る
  await page.goto("/kakeibo?record=1");
  const create = page.getByRole("dialog", { name: "記録する" });
  await create.getByLabel("金額").fill("900");
  await create.getByRole("radio", { name: "食費" }).click();
  await create.getByRole("button", { name: "よく使う記録にする" }).click();
  await create.getByLabel("よく使う記録の名前").fill("昼ごはん");
  await create.getByRole("button", { name: "残す" }).click();
  await expect(page.getByText("よく使う記録にしました")).toBeVisible();

  await page.goto("/");
  const tabs = page.getByRole("navigation", { name: "下のタブ" });
  await tabs.getByRole("button", { name: "記録する" }).click();
  // よく使う記録のカードも、弧と同じく document.body へ portal で出るので page から探す
  await page
    .getByRole("group", { name: "よく使う記録" })
    .getByRole("button", { name: /昼ごはん/ })
    .click();

  const sheet = page.getByRole("dialog", { name: "記録する" });
  await expect(sheet.getByLabel("金額")).toHaveValue("900");
  await expect(sheet.getByRole("radio", { name: "食費", checked: true })).toBeVisible();
});

test("新しい見た目・スマホでも、カレンダータブでは上の帯の近くのアイコンだけの切り替えで週・日表示に移れる", async ({
  page,
}) => {
  // 刷新 3(0092、issue #240)から、`/` は今日のページになった。月週日の切り替えは
  // 下のタブの「カレンダー」(`/?view=month`)の画面に残る
  await page.goto("/?view=month");
  await page.getByRole("radio", { name: "週" }).last().click();
  await expect(page.getByRole("region", { name: "週の予定" })).toBeVisible();
  await page.getByRole("radio", { name: "日" }).last().click();
  await expect(page.getByRole("region", { name: "日の予定" })).toBeVisible();
});

test("PC(1024px 以上)では、新しい見た目でも下のタブの帯が出ない", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("navigation", { name: "下のタブ" })).toBeHidden();
});
