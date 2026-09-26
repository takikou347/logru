import { expect, type Locator, test } from "@playwright/test";
import { addEvent, addExtension, dayPanel, signUp } from "./helpers";

/**
 * シート・ダイアログの右上の閉じるボタン(×)が、どこで開いても同じ大きさ・見た目になったか。issue #223、0083
 * `CloseButton`(1 つの部品)の押せる範囲(size-11、44px 四方)を、それぞれの場面で測って比べる。
 */
test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

/** 開いているダイアログ・シートの中の閉じるボタン(×)。`data-slot="close-button"` で、下の明示の「閉じる」ボタンと区別する */
function closeButton(host: Locator): Locator {
  return host.locator('[data-slot="close-button"]');
}

test("家計簿の記録、予定、リスト、思い出の記録、機能のシート、書きかけの確かめ、繰り返しの範囲のダイアログで、閉じるボタンの大きさと見た目が同じ", async ({
  page,
}) => {
  // 7 つの場面を 1 つずつ開くため、既定の 45 秒では足りない
  test.setTimeout(120_000);
  const sizes: { name: string; box: { width: number; height: number } }[] = [];

  async function measure(name: string, host: Locator) {
    const button = closeButton(host);
    await expect(button).toBeVisible();
    await expect(button).toHaveAccessibleName("閉じる");
    // 開く動き(0077、320ms)が終わってから測る。途中だと scale の分だけ小さく見える
    await page.waitForTimeout(400);
    const box = await button.boundingBox();
    if (!box) throw new Error(`${name} の閉じるボタンの位置が取れなかった`);
    sizes.push({ name, box: { width: box.width, height: box.height } });
  }

  // 家計簿の記録
  await addExtension(page, "家計簿");
  await page.goto("/kakeibo");
  await page.getByRole("toolbar", { name: "家計簿の操作" }).getByRole("button", { name: "支出を記録する" }).click();
  const kakeibo = page.getByRole("dialog", { name: "記録する" });
  await measure("家計簿の記録", kakeibo);
  await page.keyboard.press("Escape");
  await expect(kakeibo).toBeHidden();

  // 予定。「予定を足す」はカレンダーの画面にしか無い
  await page.goto("/");
  await addEvent(page, "歯医者");
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const event = page.getByRole("dialog", { name: "新しい予定" });
  await measure("予定", event);
  await page.keyboard.press("Escape");
  await expect(event).toBeHidden();

  // リスト
  await addExtension(page, "リスト");
  await page.goto("/lists");
  await page.getByRole("toolbar", { name: "リストの操作" }).getByRole("button", { name: "リストを作る" }).click();
  const list = page.getByRole("dialog", { name: "リストを作る" });
  await measure("リスト", list);
  await page.keyboard.press("Escape");
  await expect(list).toBeHidden();

  // 思い出の記録
  await addExtension(page, "思い出");
  await page.goto("/memories?record=1");
  const memories = page.getByRole("dialog", { name: "記録する" });
  await measure("思い出の記録", memories);
  await page.keyboard.press("Escape");
  await expect(memories).toBeHidden();

  // 機能のシート
  await page.goto("/");
  await page.getByRole("toolbar", { name: "カレンダーの操作" }).getByRole("button", { name: "機能" }).click();
  const features = page.getByRole("dialog", { name: "機能" });
  await measure("機能のシート", features);
  await page.keyboard.press("Escape");
  await expect(features).toBeHidden();

  // 書きかけの確かめ。issue #200
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const draft = page.getByRole("dialog", { name: "新しい予定" });
  await draft.getByLabel("題名").fill("買い物");
  const list2 = draft.getByRole("region", { name: /日の予定$/ });
  await list2.getByRole("button", { name: /日の予定/ }).click();
  await list2.getByRole("button", { name: /歯医者/ }).click();
  const discard = page.getByRole("dialog", { name: "書きかけを捨てて開きますか" });
  await measure("書きかけの確かめ", discard);
  await discard.getByRole("button", { name: "やめる" }).click();
  await expect(discard).toBeHidden();
  await draft.getByRole("button", { name: "やめる" }).click();

  // 繰り返しの範囲。決定 0043
  await page.getByRole("radio", { name: "週", exact: true }).last().click();
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const repeatSheet = page.getByRole("dialog", { name: "新しい予定" });
  await repeatSheet.getByLabel("題名").fill("毎週のジム");
  await repeatSheet.getByRole("radio", { name: "毎週" }).click();
  await repeatSheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予定を足しました")).toBeVisible();
  const week = page.getByRole("region", { name: "週の予定" });
  await week.getByRole("button", { name: /毎週のジム/ }).click();
  await page.getByRole("dialog", { name: "予定を直す" }).getByRole("button", { name: "予定を消す" }).click();
  const scope = page.getByRole("dialog", { name: "どの回を消しますか" });
  await measure("繰り返しの範囲", scope);
  await scope.getByRole("button", { name: "この回だけ" }).click();

  // 全部、同じ大きさ(44px 四方)になっているか
  expect(sizes).toHaveLength(7);
  for (const { name, box } of sizes) {
    expect(box.width, `${name} の幅`).toBeCloseTo(44, 0);
    expect(box.height, `${name} の高さ`).toBeCloseTo(44, 0);
  }
  const [first, ...rest] = sizes;
  for (const { name, box } of rest) {
    expect(box.width, `${name} の幅が ${first.name} と違う`).toBeCloseTo(first.box.width, 0);
    expect(box.height, `${name} の高さが ${first.name} と違う`).toBeCloseTo(first.box.height, 0);
  }
});
