/**
 * release のレビューで、前と後を並べる主な画面を撮る。データは seed.shots.ts が入れる。
 *
 * 1 枚ごとに 1 つのテストにする。1 枚が落ちても、ほかは撮り続ける。
 * 撮る幅と明るさは variants で決める。スマホのダーク(390-dark)は全部撮る。
 * 名前は `<番号>-<画面>-<幅>-<明るさ>.png`。
 */
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { dayPanel } from "../helpers";
import {
  bottomStrip,
  DATA,
  login,
  note,
  OUT,
  openNewEvent,
  readSeed,
  type Seed,
  saveTitles,
  shot,
  shotStack,
  skipIfAbsent,
  tokyoDate,
  visible,
} from "./common";

type Variant = "390-dark" | "390-light" | "1440-light" | "1440-dark";
type Screen = {
  name: string;
  /** 表の「画面」の列に出す名前 */
  title: string;
  variants: Variant[];
  /** 誰で撮るか。既定は seed(データを入れた人) */
  who?: "seed" | "fresh";
  run: (page: Page, seed: Seed) => Promise<void>;
};

const DARK: Variant[] = ["390-dark"];
const PHONE: Variant[] = ["390-dark", "390-light"];
const ALL: Variant[] = ["390-dark", "390-light", "1440-light"];
const PC: Variant[] = ["1440-light", "1440-dark"];

/** 今日を選んだカレンダーを開く */
async function openToday(page: Page) {
  await page.goto(`/?date=${tokyoDate(0)}`);
  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();
  await expect(dayPanel(page).getByText(DATA.today).first()).toBeVisible();
}

/** 要素を画面の上に寄せる。スマホで下にあるものを撮るときに使う */
async function scrollToTop(page: Page, selector: ReturnType<Page["locator"]>) {
  await selector.first().evaluate((el) => el.scrollIntoView({ block: "start" }));
}

/** 下の帯の「機能」を押して、機能のシートを開く */
async function openExtensionsSheet(page: Page) {
  await page.getByRole("toolbar", { name: "カレンダーの操作" }).getByRole("button", { name: "機能" }).click();
  const sheet = page.getByRole("dialog", { name: "機能" });
  await expect(sheet).toBeVisible();
  return sheet;
}

const screens: Screen[] = [
  {
    name: "01-month",
    title: "カレンダーの月の表(今日を選んだ状態)",
    variants: ALL,
    run: async (page) => {
      await openToday(page);
    },
  },
  {
    name: "02-daycard",
    title: "その日の中身(日のカード)",
    variants: DARK,
    run: async (page) => {
      await openToday(page);
      await scrollToTop(page, dayPanel(page));
    },
  },
  {
    name: "03-event-sheet",
    title: "予定を足すシート(繰り返しを開いた状態)",
    variants: DARK,
    run: async (page) => {
      await openToday(page);
      const sheet = await openNewEvent(page);
      await sheet.getByLabel("題名").fill(DATA.weekly);
      const weekly = sheet.getByRole("radio", { name: "毎週" });
      if (await visible(weekly, 3_000)) {
        await weekly.click();
        await scrollToTop(page, sheet.getByText("繰り返し", { exact: true }));
      } else {
        note("03-event-sheet", "本番には無い: 繰り返し。シートだけ撮った");
      }
    },
  },
  {
    name: "04-bottom-bars",
    title: "下の帯と「+」(画面ごとに並べた)",
    variants: DARK,
    run: async (page, seed) => {
      const parts: { label: string; png: Buffer }[] = [];
      await openToday(page);
      parts.push({ label: "カレンダー", png: await bottomStrip(page) });
      for (const [key, label, path] of [
        ["memories", "思い出", "/memories"],
        ["kakeibo", "家計簿", "/kakeibo"],
        ["lists", "リスト", "/lists"],
      ] as const) {
        if (!seed.features[key]) {
          note(`04-bottom-bars ${label}`, "本番には無い");
          continue;
        }
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        parts.push({ label, png: await bottomStrip(page) });
      }
      await page.goto("/settings");
      parts.push({ label: "設定", png: await bottomStrip(page) });
      await shotStack(page, "04-bottom-bars", parts);
    },
  },
  {
    name: "05-extensions-sheet",
    title: "機能のシート",
    variants: ALL,
    run: async (page) => {
      if (page.viewportSize()!.width >= 1024) {
        note("05-extensions-sheet 1440", "PC には機能のシートが無い。機能は左の列に並ぶ(01 の PC の画像)");
        test.skip(true, "PC には機能のシートが無い");
      }
      await openToday(page);
      await openExtensionsSheet(page);
    },
  },
  {
    name: "05-settings-extensions",
    title: "設定の「機能」",
    variants: ALL,
    run: async (page) => {
      await page.goto("/settings/extensions");
      if (!(await visible(page.getByRole("heading", { name: "機能", level: 1 }), 5_000))) {
        // 本番は /extensions にトグルで並ぶ
        await page.goto("/extensions");
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      }
    },
  },
  {
    name: "06-extension-add",
    title: "機能を足す画面",
    variants: DARK,
    who: "fresh",
    run: async (page) => {
      await page.goto("/settings/extensions/add");
      const ok = await visible(page.getByRole("heading", { name: "機能を足す" }), 5_000);
      skipIfAbsent("06-extension-add", ok, "機能を足す画面(本番は /extensions のトグル)");
    },
  },
  {
    name: "07-settings-toc",
    title: "設定の目次",
    variants: PHONE,
    run: async (page) => {
      await page.goto("/settings");
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    },
  },
  {
    name: "07-settings-appearance",
    title: "設定の「見た目」",
    variants: PHONE,
    run: async (page) => {
      await page.goto("/settings/appearance");
      if (!(await visible(page.getByRole("heading", { name: "見た目" }), 5_000))) {
        // 本番は 1 枚の設定の中に明るさがある
        await page.goto("/settings");
        await scrollToTop(page, page.getByRole("radio", { name: "ダーク" }));
        note("07-settings-appearance", "本番は目次が無いので、1 枚の設定の明るさの所を撮った");
      }
    },
  },
  {
    name: "08-memories-list",
    title: "思い出の一覧",
    variants: DARK,
    run: async (page, seed) => {
      skipIfAbsent("08-memories-list", seed.features.memories, "思い出");
      await page.goto("/memories");
      await expect(page.getByText(DATA.memory).first()).toBeVisible();
    },
  },
  {
    name: "08-memories-onday",
    title: "思い出の「その日」",
    variants: DARK,
    run: async (page, seed) => {
      skipIfAbsent("08-memories-onday", seed.features.memories, "思い出");
      await page.goto("/memories");
      // 最近の記録のカードから、その日の画面へ
      await page.locator('a[href*="/memories/on/"]').first().click();
      await expect(page).toHaveURL(/\/memories\/on\//);
      await expect(page.getByText(DATA.record).first()).toBeVisible();
    },
  },
  {
    name: "08-record-sheet",
    title: "記録のシート(共有の行)",
    variants: DARK,
    run: async (page, seed) => {
      skipIfAbsent("08-record-sheet", seed.features.memories, "思い出");
      await page.goto("/memories?record=1");
      const sheet = page.getByRole("dialog", { name: "記録する" });
      await expect(sheet).toBeVisible();
      await sheet.getByLabel("文章").fill("足湯で休けい");
      const row = sheet.getByRole("button", { name: /^共有/ });
      if (await visible(row)) await row.first().scrollIntoViewIfNeeded();
    },
  },
  {
    name: "09-kakeibo",
    title: "家計簿",
    variants: DARK,
    run: async (page, seed) => {
      skipIfAbsent("09-kakeibo", seed.features.kakeibo, "家計簿");
      await page.goto("/kakeibo");
      await expect(page.getByTestId("kakeibo-total")).toBeVisible();
    },
  },
  {
    name: "09-kakeibo-accounts",
    title: "家計簿の口座",
    variants: DARK,
    run: async (page, seed) => {
      skipIfAbsent("09-kakeibo-accounts", seed.features.kakeiboAccounts, "家計簿の口座");
      await page.goto("/kakeibo/accounts");
      await expect(page.getByRole("heading", { name: "家計簿の口座" })).toBeVisible();
    },
  },
  {
    name: "09-lists",
    title: "共有リスト",
    variants: DARK,
    run: async (page, seed) => {
      skipIfAbsent("09-lists", seed.features.lists, "共有リスト");
      await page.goto("/lists");
      await page
        .getByRole("link", { name: new RegExp(DATA.list) })
        .first()
        .click();
      await expect(page.getByText(DATA.items[1]).first()).toBeVisible();
    },
  },
  {
    name: "09-weather",
    title: "天気(日のカードから開いたシート)",
    variants: DARK,
    run: async (page, seed) => {
      skipIfAbsent("09-weather", seed.features.weather, "天気");
      await openToday(page);
      await dayPanel(page).getByRole("button", { name: /晴れ/ }).first().click();
      await expect(page.getByRole("dialog").first()).toBeVisible();
    },
  },
  {
    name: "10-search",
    title: "探す",
    variants: DARK,
    run: async (page) => {
      await openToday(page);
      const open = page.getByRole("button", { name: "探す" });
      skipIfAbsent("10-search", await visible(open, 5_000), "探す");
      await open.first().click();
      const dialog = page.getByRole("dialog", { name: "探す" });
      await dialog.getByLabel("探す").fill(DATA.search);
      await expect(dialog.getByRole("button", { name: new RegExp(DATA.tomorrow) })).toBeVisible();
    },
  },
  {
    name: "11-empty-day",
    title: "空の画面: 予定の無い日",
    variants: DARK,
    run: async (page) => {
      await page.goto(`/?date=${tokyoDate(10)}`);
      await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();
      await scrollToTop(page, dayPanel(page));
    },
  },
  {
    name: "11-empty-kakeibo",
    title: "空の画面: 家計簿の記録の無い月",
    variants: DARK,
    run: async (page, seed) => {
      skipIfAbsent("11-empty-kakeibo", seed.features.kakeibo, "家計簿");
      await page.goto("/kakeibo");
      await page.getByRole("button", { name: "前の月" }).first().click();
      await expect(page.getByTestId("kakeibo-total")).toHaveText("¥0");
    },
  },
  {
    name: "11-empty-add",
    title: "空の画面: 足せる機能が無いとき",
    variants: DARK,
    run: async (page) => {
      await page.goto("/settings/extensions/add");
      const ok = await visible(page.getByRole("heading", { name: "機能を足す" }), 5_000);
      skipIfAbsent("11-empty-add", ok, "機能を足す画面");
    },
  },
  {
    name: "11-empty-bell",
    title: "空の画面: お知らせ",
    variants: DARK,
    run: async (page) => {
      await openToday(page);
      await page.getByRole("button", { name: "お知らせ" }).first().click();
      await expect(page.getByRole("dialog").first()).toBeVisible();
    },
  },
  {
    name: "12-pc-week",
    title: "PC のカレンダー(週)",
    variants: PC,
    run: async (page) => {
      await openToday(page);
      await page.getByRole("radio", { name: "週", exact: true }).last().click();
      await expect(page.getByRole("region", { name: "週の予定" })).toBeVisible();
    },
  },
];

// 表を作る scripts/shots-table.mjs が、画面の名前をここから読む
saveTitles(screens.map((s) => [s.name, s.title]));

// 落ちた画面は notes.tsv に残し、そのときの画面を failed/ に置く。表を作るときに、撮れなかった理由が分かるように
test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus) return;
  const name = `${info.title}-${info.project.name}`;
  note(name, `落ちた: ${(info.error?.message ?? "").split("\n")[0]}`);
  await page.screenshot({ path: path.join(OUT, "failed", `${name}.png`) }).catch(() => {});
});

for (const screen of screens) {
  test(screen.name, async ({ page }, info) => {
    test.skip(!screen.variants.includes(info.project.name as Variant), "この幅と明るさでは撮らない");
    const seed = readSeed();
    await login(page, screen.who);
    await screen.run(page, seed);
    // 04 は自分で撮る
    if (screen.name !== "04-bottom-bars") await shot(page, screen.name);
  });
}
