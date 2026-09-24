/**
 * 撮る前に、同じデータを入れる。利用者は Auth エミュレーターの試しの利用者。
 * 1 つの手順が落ちても、残りは続ける。落ちた手順は notes.tsv に残る。
 */
import { expect, type Page, test } from "@playwright/test";
import { signUp } from "../helpers";
import {
  DATA,
  enableExtension,
  note,
  openNewEvent,
  PHOTO,
  pickShare,
  resetNotes,
  type Seed,
  saveFresh,
  saveSeed,
  tokyoDate,
  visible,
} from "./common";

test.setTimeout(240_000);

async function step(name: string, fn: () => Promise<unknown>) {
  try {
    await test.step(name, fn);
  } catch (e) {
    note(`seed: ${name}`, `落ちた: ${String(e).split("\n")[0]}`);
  }
}

async function createGroup(page: Page, name: string) {
  await page.goto("/groups");
  await page.getByLabel("グループの名前").fill(name);
  await page.getByRole("button", { name: "作る" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

/**
 * 開いているグループの画面で、機能をそのグループでも使えるようにする。共有の相手にグループを出すため。
 * 新しい形は「<名前>を足す」のボタン、古い形はトグル。
 */
async function enableInGroup(page: Page, label: string) {
  const add = page.getByRole("button", { name: `${label}を足す`, exact: true });
  if (await visible(add)) {
    await add.click();
    await expect(page.getByRole("button", { name: `${label}を外す`, exact: true })).toBeVisible();
    return;
  }
  const toggle = page.getByRole("switch", { name: label, exact: true });
  if (!(await visible(toggle))) return;
  if ((await toggle.getAttribute("aria-checked")) !== "true") await toggle.click();
  await expect(toggle).toBeChecked();
}

async function addEventOn(
  page: Page,
  opts: { title: string; date: string; time: [string, string]; group?: string; weekly?: boolean },
) {
  // 日を選んでから開く。シートの中で日付を変えると、毎週の曜日が開いたときの日のまま残るため
  await page.goto(`/?date=${opts.date}`);
  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();
  const sheet = await openNewEvent(page);
  await sheet.getByLabel("題名").fill(opts.title);
  await sheet.getByLabel("日付").fill(opts.date);
  await sheet.getByLabel("始まり", { exact: true }).fill(opts.time[0]);
  await sheet.getByLabel("終わり", { exact: true }).fill(opts.time[1]);
  if (opts.group) await pickShare(page, sheet, opts.group);
  let repeated = false;
  if (opts.weekly) {
    const weekly = sheet.getByRole("radio", { name: "毎週" });
    if (await visible(weekly, 1_500)) {
      await weekly.click();
      repeated = true;
    }
  }
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予定を足しました")).toBeVisible();
  return repeated;
}

test("同じデータを入れる", async ({ page }) => {
  resetNotes();
  const features: Record<string, boolean> = {};
  const user = await signUp(page, { name: DATA.me });

  await step("グループ", async () => {
    await createGroup(page, DATA.pair);
    await createGroup(page, DATA.longGroup);
  });

  await step("アバター", async () => {
    await page.goto("/settings/appearance");
    let panel = page.getByRole("region", { name: "アバター" });
    if (!(await visible(panel, 5_000))) {
      await page.goto("/settings");
      panel = page.getByRole("region", { name: "アバター" });
    }
    await panel.locator('input[type="file"]').setInputFiles(PHOTO);
    await expect(page.getByText("アバターを写真にしました")).toBeVisible();
    features.avatar = true;
  });

  await step("機能を足す", async () => {
    for (const [key, label] of [
      ["memories", "思い出"],
      ["kakeibo", "家計簿"],
      ["lists", "リスト"],
    ] as const) {
      features[key] = await enableExtension(page, label);
    }
  });

  await step("ふたりでも機能を使う", async () => {
    await page.goto("/groups");
    await page
      .getByRole("link", { name: new RegExp(DATA.pair) })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: DATA.pair })).toBeVisible();
    for (const label of ["思い出", "家計簿", "リスト"]) await enableInGroup(page, label);
  });

  await step("予定", async () => {
    features.repeat = await addEventOn(page, {
      title: DATA.weekly,
      date: tokyoDate(0),
      time: ["07:00", "08:00"],
      weekly: true,
    });
    await addEventOn(page, { title: DATA.today, date: tokyoDate(0), time: ["10:00", "11:00"] });
    await addEventOn(page, { title: DATA.shared, date: tokyoDate(0), time: ["19:00", "21:00"], group: DATA.pair });
    await addEventOn(page, { title: DATA.tomorrow, date: tokyoDate(1), time: ["12:00", "12:30"] });
  });

  if (features.memories)
    await step("思い出", async () => {
      await page.goto("/memories");
      const addMenu = page.getByRole("button", { name: "思い出を足す" });
      if (await visible(addMenu, 5_000)) {
        await addMenu.click();
        await page.getByRole("dialog", { name: "思い出を足す" }).getByRole("button", { name: "思い出を作る" }).click();
      } else {
        await page.getByRole("button", { name: "思い出を作る" }).first().click();
      }
      const create = page.getByRole("dialog", { name: "思い出を作る" });
      await create.getByLabel("題名").fill(DATA.memory);
      await pickShare(page, create, DATA.pair);
      await create.getByRole("button", { name: "作る" }).click();
      await expect(page).toHaveURL(/\/days\/0$/);

      await page.getByRole("toolbar", { name: "1 日の操作" }).getByRole("button", { name: "記録する" }).click();
      const record = page.getByRole("dialog", { name: "記録する" });
      await record.locator('input[type="file"][multiple]').setInputFiles(PHOTO);
      await expect(record.getByRole("button", { name: "保存する" })).toBeEnabled({ timeout: 20_000 });
      await record.getByLabel("文章").fill(DATA.record);
      await record.getByRole("button", { name: "保存する" }).click();
      await expect(page.getByText("記録しました")).toBeVisible();
    });

  if (features.kakeibo)
    await step("家計簿", async () => {
      await page.goto("/kakeibo");
      // 空の月は、下の帯の「+」と空の枠のボタンの 2 つがある。どちらも同じシートを開く
      await page.getByRole("button", { name: "支出を記録する" }).first().click();
      const create = page.getByRole("dialog", { name: "記録する" });
      await create.getByLabel("金額").fill(DATA.expense);
      await create.getByRole("radio", { name: "食費" }).click();
      await create.getByRole("button", { name: "保存する" }).click();
      await expect(page.getByText("記録しました")).toBeVisible();
    });

  if (features.lists)
    await step("共有リスト", async () => {
      await page.goto("/lists");
      await page.getByRole("button", { name: "リストを作る" }).first().click();
      const create = page.getByRole("dialog", { name: "リストを作る" });
      await create.getByLabel("名前").fill(DATA.list);
      await create.getByLabel("日付").fill(tokyoDate(0));
      await pickShare(page, create, DATA.pair);
      await create.getByRole("button", { name: "作る" }).click();
      await expect(page).toHaveURL(/\/lists\/.+/);
      // 2026-w39 に「項目を追加」から「項目を足す」へ変わった。前の版でも撮れるよう両方を試す
      const input = page.getByLabel(/^項目を(足す|追加)$/);
      for (const item of DATA.items) {
        await input.fill(item);
        await input.press("Enter");
        await expect(page.getByText(item)).toBeVisible();
      }
      await page.getByRole("checkbox", { name: `${DATA.items[0]} をチェックする` }).click();
    });

  await step("天気", async () => {
    await page.goto("/settings/extensions/weather");
    const section = page.getByRole("region", { name: "天気" });
    const choose = section.getByRole("button", { name: /場所を(選ぶ|変える)/ });
    if (!(await visible(choose, 5_000))) {
      features.weather = false;
      return;
    }
    await choose.click();
    const sheet = page.getByRole("dialog", { name: "場所を選ぶ" });
    await sheet.getByLabel("市区町村の名前で探す").fill(DATA.place);
    await sheet.getByRole("listitem").first().getByRole("button").click();
    await expect(sheet).toBeHidden();
    features.weather = true;
  });

  const seed: Seed = { email: user.email, features };
  saveSeed(seed);
});

test("何も足していない人を作る", async ({ page }) => {
  const user = await signUp(page, { name: "はじめ" });
  saveFresh(user.email);
});
