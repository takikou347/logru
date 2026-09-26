import { expect, type Locator, type Page, test } from "@playwright/test";
import { addExtension, addMemories, signUp, tokyoDateParts } from "./helpers";

/** 来月の `yyyy-mm` の形。今月はもう始まりを過ぎているとみなされ、すぐ記録されてしまうのを避ける */
function nextMonthKey(): string {
  const { year, month } = tokyoDateParts(35);
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** 機能の一覧で、家計簿を自分だけで使えるようにする */
async function enableKakeibo(page: Page) {
  await addExtension(page, "家計簿");
}

/**
 * 属性が短い間だけでも一度 value になったことを、見張り始めてから確かめられるようにする。
 *
 * 消す・直すの動きは 220〜320ms しか続かない。動きを起こす操作(クリックなど)の後で見張り始めると、
 * ブラウザとの往復の遅さの分だけ、短い窓を取りこぼすことがある。この環境は往復が遅いことがあるため、
 * 動きを起こす操作より前に見張りを仕掛け、`MutationObserver` で待つ。
 *
 * `locator` は role ではなく CSS・文字で見分けたものを渡す。シートが開くと背後の一覧は
 * aria-hidden になり、role で見分ける locator はその間解決できなくなるため。
 * @returns 呼ぶと、value になるまで(すでにそうならすぐ)待つ関数
 */
async function watchAttribute(locator: Locator, attr: string, value: string): Promise<() => Promise<void>> {
  const handle = await locator.elementHandle();
  if (!handle) throw new Error("要素が見つからない");
  const promise = handle.evaluate(
    (el, [a, v]) =>
      new Promise<void>((resolve, reject) => {
        if (el.getAttribute(a) === v) {
          resolve();
          return;
        }
        const timer = window.setTimeout(() => {
          obs.disconnect();
          reject(new Error(`${a} が ${v} にならなかった`));
        }, 5000);
        const obs = new MutationObserver(() => {
          if (el.getAttribute(a) === v) {
            window.clearTimeout(timer);
            obs.disconnect();
            resolve();
          }
        });
        obs.observe(el, { attributes: true });
      }),
    [attr, value] as [string, string],
  );
  return () => promise;
}

/**
 * CRUD の動きが、口座・予算・定期の記録・よく使う記録・思い出の記録の一覧に付くことを確かめる。0044、0048、0085、issue #226
 *
 * 足した行に item-enter、消した行に data-leaving が付き、縮んでから一覧から外れる。
 * 直した行には data-edited が短く付く。動きを減らす設定では、これらが出ない。
 *
 * 行は、消す・直すシートを開いたまま見分けられるよう、role ではなく `<li>`・`<button>` と
 * 文字(hasText)で見分ける。シートが開くと背後は aria-hidden になり、role の locator は使えないため。
 */

test("口座を作ると膨らんで入り、直すと光り、消すと縮んで一覧から外れる", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableKakeibo(page);

  await page.goto("/kakeibo/accounts");
  await page.getByRole("toolbar", { name: "口座の操作" }).getByRole("button", { name: "口座を作る" }).click();
  const create = page.getByRole("dialog", { name: "口座を作る" });
  await create.getByLabel("名前").fill("現金");
  await create.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("口座を作りました")).toBeVisible();

  const row = page.locator("li").filter({ hasText: "現金" });
  await expect(row).toHaveClass(/item-enter/);

  // 直すと、保存した直後だけ data-edited が付く
  await page.getByLabel("現金 を直す").click();
  const editSheet = page.getByRole("dialog", { name: "口座を直す" });
  await editSheet.getByLabel("始まりの残高").fill("500");
  const edited = await watchAttribute(row, "data-edited", "true");
  await editSheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("口座を直しました")).toBeVisible();
  await edited();
  await expect(row).not.toHaveAttribute("data-edited", "true", { timeout: 2000 });

  // 消すと、縮んで消える動きの間だけ一覧に残り、動きが終わってから外れる
  await row.getByLabel("現金 を直す").click();
  const leaving = await watchAttribute(row, "data-leaving", "true");
  await page.getByRole("dialog", { name: "口座を直す" }).getByRole("button", { name: "消す" }).click();
  await expect(page.getByText("口座を消しました")).toBeVisible();
  await leaving();
  await expect(page.getByText("まだ口座がありません。")).toBeVisible();
});

test("予算を作ると膨らんで入り、消すと縮んで一覧から外れる", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableKakeibo(page);

  await page.goto("/kakeibo/budgets");
  await page.getByRole("toolbar", { name: "予算の操作" }).getByRole("button", { name: "予算を作る" }).click();
  const create = page.getByRole("dialog", { name: "予算を作る" });
  await create.getByLabel("名前").fill("食費");
  await create.getByLabel("金額").fill("10000");
  await create.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予算を作りました")).toBeVisible();

  const row = page.locator("button").filter({ hasText: "食費" });
  await expect(row).toHaveClass(/item-enter/);

  await row.click();
  const leaving = await watchAttribute(row, "data-leaving", "true");
  await page.getByRole("dialog", { name: "予算を直す" }).getByRole("button", { name: "消す" }).click();
  await expect(page.getByText("予算を消しました")).toBeVisible();
  await leaving();
  await expect(page.getByText("まだ予算がありません。")).toBeVisible();
});

test("定期の記録を作ると膨らんで入り、消すと縮んで一覧から外れる", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableKakeibo(page);

  await page.goto("/kakeibo/recurrings");
  await page
    .getByRole("toolbar", { name: "定期の記録の操作" })
    .getByRole("button", { name: "定期の記録を作る" })
    .click();
  const create = page.getByRole("dialog", { name: "定期の記録を作る" });
  await create.getByLabel("金額").fill("1000");
  await create.getByRole("radio", { name: "住まい" }).click();
  // 始まりの月を来月にし、決めた日をもう過ぎている扱いですぐ記録されないようにする
  await create.getByLabel("始まりの月").fill(nextMonthKey());
  await create.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("定期の記録を作りました")).toBeVisible();
  // 作るシートが閉じ切るまで待つ。カテゴリの選択肢にも同じ「住まい」の文字を持つ button があるため
  await expect(create).toBeHidden();

  // カテゴリの選択肢は role が radio なので、role で button だけに絞る。行は、その button を持つ li
  const button = page.getByRole("button").filter({ hasText: "住まい" });
  const row = page.locator("li").filter({ has: button });
  await expect(row).toHaveClass(/item-enter/);

  // 直すシートが開くと一覧は aria-hidden になり role で引けなくなるので、開く前に行を捕まえる
  const leaving = await watchAttribute(row, "data-leaving", "true");
  await button.click();
  await page.getByRole("dialog", { name: "定期の記録を直す" }).getByRole("button", { name: "消す" }).click();
  await expect(page.getByText("定期の記録を消しました")).toBeVisible();
  await leaving();
  await expect(page.getByText("まだ定期の記録がありません。")).toBeVisible();
});

test("よく使う記録を作ると膨らんで入り、直すと光り、消すと縮んで一覧から外れる", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await enableKakeibo(page);

  // よく使う記録は、記録するシートの「よく使う記録にする」から作る。F-326
  await page.goto("/kakeibo");
  await page.getByRole("toolbar", { name: "家計簿の操作" }).getByRole("button", { name: "支出を記録する" }).click();
  const record = page.getByRole("dialog", { name: "記録する" });
  await record.getByLabel("金額").fill("500");
  await record.getByRole("radio", { name: "日用品" }).click();
  await record.getByRole("button", { name: "よく使う記録にする" }).click();
  await record.getByLabel("よく使う記録の名前").fill("いつもの買い物");
  await record.getByRole("button", { name: "残す" }).click();
  await expect(page.getByText("よく使う記録にしました")).toBeVisible();
  await record.getByRole("button", { name: "やめる" }).click();

  // 作った直後(3 秒以内)に、画面を移らず(SPA のリンクで)その一覧を開くと、膨らんで入る動きが付く。
  // page.goto は本当のページ遷移になり、足した直後を覚える印(JS の Map)が消えてしまうため使わない。
  // 行は「消す」の文字を持つ li で見分ける(名前を直すと文字が変わるので、行そのものは名前の文字では追わない)
  await page.getByRole("link", { name: "よく使う記録" }).click();
  await expect(page).toHaveURL(/\/kakeibo\/templates$/);
  const row = page.locator("li").filter({ hasText: "消す" });
  await expect(row).toHaveClass(/item-enter/);

  // その場で名前を直すと、直後だけ光る印が付く
  await page.getByText("いつもの買い物").click();
  await page.getByLabel("いつもの買い物 を直す").fill("スーパー");
  const edited = await watchAttribute(row, "data-edited", "true");
  await page.getByLabel("いつもの買い物 を直す").press("Enter");
  await expect(page.getByText("スーパー")).toBeVisible();
  await edited();

  // 消すと、縮んで消える動きの間だけ一覧に残る
  const leaving = await watchAttribute(row, "data-leaving", "true");
  await row.getByRole("button", { name: "消す" }).click();
  await expect(page.getByText("よく使う記録を消しました")).toBeVisible();
  await leaving();
  await expect(page.getByText("まだよく使う記録がありません。")).toBeVisible();
});

test("思い出の記録を作ると膨らんで入り、消すと縮んで一覧から外れる", async ({ page }) => {
  await signUp(page, { name: "こた" });
  await addExtension(page, "思い出");
  await page.goto("/memories");
  await addMemories(page, "思い出を作る");
  const create = page.getByRole("dialog", { name: "思い出を作る" });
  await create.getByLabel("題名").fill("箱根 日帰り");
  await create.getByRole("button", { name: "作る" }).click();
  await expect(page.getByRole("heading", { name: "箱根 日帰り" })).toBeVisible();

  await page.getByRole("toolbar", { name: "1 日の操作" }).getByRole("button", { name: "記録する" }).click();
  const record = page.getByRole("dialog", { name: "記録する" });
  await record.getByLabel("文章").fill("湯本に着いた");
  await record.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();

  // 「1 日の流れ」は role(list)ではなく aria-label で見分ける。シートが開くと背後は aria-hidden になるため
  const flow = page.locator('[aria-label="1 日の流れ"]');
  const row = flow.locator("li").filter({ hasText: "湯本に着いた" });
  await expect(row).toHaveClass(/item-enter/);

  await row.getByRole("button", { name: "編集" }).click();
  const leaving = await watchAttribute(row, "data-leaving", "true");
  await page.getByRole("dialog", { name: "記録を編集" }).getByRole("button", { name: "消す" }).click();
  await expect(page.getByText("記録を消しました")).toBeVisible();
  await leaving();
  await expect(page.getByText("この日の記録はまだありません。")).toBeVisible();
});

test("動きを減らす設定では、足す・消すの動きが出ない", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signUp(page, { name: "こた" });
  await enableKakeibo(page);

  await page.goto("/kakeibo/accounts");
  await page.getByRole("toolbar", { name: "口座の操作" }).getByRole("button", { name: "口座を作る" }).click();
  const create = page.getByRole("dialog", { name: "口座を作る" });
  await create.getByLabel("名前").fill("現金");
  await create.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("口座を作りました")).toBeVisible();

  const row = page.locator("li").filter({ hasText: "現金" });
  await expect(row).toHaveClass(/item-enter/);
  const enterDuration = await row.evaluate((el) => getComputedStyle(el).animationDuration);
  expect(Number.parseFloat(enterDuration)).toBeLessThanOrEqual(0.001);

  await row.getByLabel("現金 を直す").click();
  const leaving = await watchAttribute(row, "data-leaving", "true");
  await page.getByRole("dialog", { name: "口座を直す" }).getByRole("button", { name: "消す" }).click();
  await expect(page.getByText("口座を消しました")).toBeVisible();
  await leaving();
  const exitDuration = await row.evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(Number.parseFloat(exitDuration)).toBeLessThanOrEqual(0.001);
});
