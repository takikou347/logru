import { expect, test } from "@playwright/test";
import { addExtension, enableNewLook, signUp } from "./helpers";

/**
 * 刷新 2。骨組み(上の帯、週の帯、下のタブ、「+」の放射)とアイコンだけの操作。0091、issue #239
 *
 * ラボの「新しい見た目」を入れた人だけに出る。入れていない人の画面は今までのまま(下のタブの
 * 帯は出ず、今までの Dock がそのまま動く)。
 */

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("新しい見た目を入れていない人には、下のタブの帯が出ない", async ({ page }) => {
  await expect(page.getByRole("navigation", { name: "下のタブ" })).toBeHidden();
  // 今までの Dock(カレンダーの操作)はそのまま動く
  await expect(page.getByRole("toolbar", { name: "カレンダーの操作" })).toBeVisible();
});

test("新しい見た目を入れると、下のタブが 5 つアイコンだけで並ぶ。読み上げの名前は残る", async ({ page }) => {
  await enableNewLook(page);
  // 4 回目以降を装う。はじめの 3 回の名前を消してから、アイコンだけの見た目を確かめる
  await page.evaluate(() => localStorage.setItem("logru:new-look-tab-hints-seen", "3"));
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

  // アイコンだけ。名前を常に出す文字(はじめの 3 回の注記)は無い
  await expect(tabs.getByTestId("tab-hint")).toHaveCount(0);
});

test("はじめの 3 回だけ、タブの下に名前が出る", async ({ page }) => {
  await enableNewLook(page);
  await page.goto("/");
  const tabs = page.getByRole("navigation", { name: "下のタブ" });
  await expect(tabs.getByTestId("tab-hint")).toHaveCount(5);
  // 名前は帯の角丸の内側に収まる。帯の下の端にかからない
  const bar = (await tabs.boundingBox())!;
  for (const hint of await tabs.getByTestId("tab-hint").all()) {
    const box = (await hint.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(bar.y + bar.height - 6);
  }

  // 4 回目からは消える
  await page.evaluate(() => localStorage.setItem("logru:new-look-tab-hints-seen", "3"));
  await page.reload();
  await expect(tabs.getByTestId("tab-hint")).toHaveCount(0);
});

test("長押しで名前が出て、離しても操作はしない", async ({ page }) => {
  await enableNewLook(page);
  await page.evaluate(() => localStorage.setItem("logru:new-look-tab-hints-seen", "3"));
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
  await enableNewLook(page);
  const tabs = page.getByRole("navigation", { name: "下のタブ" });
  await tabs.getByRole("link", { name: "機能" }).click();
  await expect(page).toHaveURL("/settings/extensions");

  await page.goto("/");
  await tabs.getByRole("link", { name: "設定" }).click();
  await expect(page).toHaveURL("/settings");
});

test("「+」は足している機能ぶんの記録の種類を出す。どの画面から押しても同じで、予定だけなら直接開く", async ({
  page,
}) => {
  await enableNewLook(page);
  // 設定の画面から押しても、カレンダーの画面から押しても同じ(いま開いている画面の addables ではない)。issue #239
  await page.goto("/settings");
  const tabs = page.getByRole("navigation", { name: "下のタブ" });
  await tabs.getByRole("button", { name: "記録する" }).click();
  await expect(page.getByRole("dialog", { name: "新しい予定" })).toBeVisible();
});

test("家計簿を足すと「+」に支出・収入が並び、放射から収入を選ぶと収入が選ばれた状態で開く", async ({ page }) => {
  await addExtension(page, "家計簿");
  await enableNewLook(page);
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
  await enableNewLook(page);
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

  await enableNewLook(page);
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
  await enableNewLook(page);
  await page.goto("/?view=month");
  await page.getByRole("radio", { name: "週" }).last().click();
  await expect(page.getByRole("region", { name: "週の予定" })).toBeVisible();
  await page.getByRole("radio", { name: "日" }).last().click();
  await expect(page.getByRole("region", { name: "日の予定" })).toBeVisible();
});

test("PC(1024px 以上)では、新しい見た目でも下のタブの帯が出ない", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await enableNewLook(page);
  await expect(page.getByRole("navigation", { name: "下のタブ" })).toBeHidden();
});
