/**
 * 画面を撮る仕組みの共通の部品。playwright.shots.config.ts から使う。
 *
 * 本番(main)のフォルダに写して流しても動くように、`../helpers` からは本番にもある関数だけを使う。
 * 画面の形が版で違うところは、新しい形を先に試し、無ければ古い形を試す。
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { logIn } from "../helpers";

/** 画像を置くフォルダ。playwright.shots.config.ts が決める */
export const OUT = process.env.SHOTS_OUT ?? path.resolve("test-results/shots/after");
const SEED_FILE = path.join(OUT, "seed.json");
const NOTES_FILE = path.join(OUT, "notes.tsv");

// 写真は Unsplash License のフリー写真を小さくしたもの。出どころは develop-docs の docs/logru/extensions/memories/images/photos/sources.txt
export const PHOTO = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/photo.jpg");

/** 入れるデータの名前。前と後で同じにする */
export const DATA = {
  me: "こた",
  pair: "ふたり",
  longGroup: "大学のフットサルサークルの同期と先輩たち 2026",
  today: "歯医者",
  shared: "ふたりで夕飯",
  tomorrow: "箱根の宿の予約",
  weekly: "朝のヨガ",
  memory: "箱根 日帰り",
  record: "湯本に着いた。まずは和菓子。",
  expense: "1200",
  list: "週末の買い物",
  items: ["にんじん", "たまねぎ", "牛乳"],
  place: "渋谷",
  search: "箱根",
} as const;

/** seed が作った利用者と、その版で使えた機能 */
export type Seed = {
  email: string;
  features: Record<string, boolean>;
};

/** 何も足していない人。機能を足す画面を、足す前の形で撮るのに使う */
const FRESH_FILE = path.join(OUT, "fresh.json");

export function saveSeed(seed: Seed) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2));
}

export function saveFresh(email: string) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(FRESH_FILE, JSON.stringify({ email }, null, 2));
}

export function readSeed(): Seed {
  if (!existsSync(SEED_FILE)) throw new Error(`${SEED_FILE} がありません。seed が落ちています`);
  return JSON.parse(readFileSync(SEED_FILE, "utf8")) as Seed;
}

function readFresh(): string {
  if (!existsSync(FRESH_FILE)) throw new Error(`${FRESH_FILE} がありません。seed が落ちています`);
  return (JSON.parse(readFileSync(FRESH_FILE, "utf8")) as { email: string }).email;
}

/** 画面の名前と、表に出す名前を titles.tsv に書く。どの worker が書いても同じ中身になる */
export function saveTitles(entries: [string, string][]) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, "titles.tsv"), `${entries.map((e) => e.join("\t")).join("\n")}\n`);
}

/** 前の回の notes.tsv を消す。seed の最初に呼ぶ */
export function resetNotes() {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(NOTES_FILE, "");
}

/** 撮れなかった理由を notes.tsv に残す。表を作るときに読む */
export function note(name: string, reason: string) {
  mkdirSync(OUT, { recursive: true });
  appendFileSync(NOTES_FILE, `${name}\t${reason}\n`);
}

/** 本番に無い機能の画面は、理由を残して飛ばす */
export function skipIfAbsent(name: string, available: boolean | undefined, what: string) {
  if (available) return;
  note(name, `本番には無い: ${what}`);
  test.skip(true, `本番には無い: ${what}`);
}

/** 日本時間の今日から offsetDays だけ進んだ日を `yyyy-mm-dd` で返す */
export function tokyoDate(offsetDays = 0): string {
  const at = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(at);
}

/** 見えていれば true。待ちすぎないように短く見る */
export async function visible(locator: Locator, timeout = 2_500): Promise<boolean> {
  try {
    await locator.first().waitFor({ state: "visible", timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * seed の利用者でログインし、カレンダーが出るまで待つ
 * @param who seed はデータを入れた人、fresh は何も足していない人
 */
export async function login(page: Page, who: "seed" | "fresh" = "seed") {
  await logIn(page, who === "seed" ? readSeed().email : readFresh());
  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible({ timeout: 20_000 });
}

/** 読み込みと動きが落ち着くのを待つ */
export async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  // 画像の読み込みを待つ。読み込めないものは飛ばす
  await page
    .evaluate(() =>
      Promise.all(
        Array.from(document.images)
          .filter((img) => !img.complete)
          .map((img) => new Promise((r) => img.addEventListener("load", r, { once: true }))),
      ),
    )
    .catch(() => {});
  await page.waitForTimeout(600);
}

/**
 * 画面を撮る。名前は `<番号>-<画面>-<幅>-<明るさ>.png`。幅と明るさは Playwright の project 名から付ける。
 * 知らせ(sonner)は画面によって出たり出なかったりするので隠す。
 */
export async function shot(page: Page, name: string) {
  const variant = test.info().project.name;
  await settle(page);
  mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${name}-${variant}.png`);
  await page.screenshot({
    path: file,
    animations: "disabled",
    caret: "hide",
    style: "[data-sonner-toaster]{display:none !important}",
  });
  await test.info().attach(name, { path: file, contentType: "image/png" });
}

/** いくつかの画面の一部を縦に並べて 1 枚にする。下の帯の比べ合わせに使う */
export async function shotStack(page: Page, name: string, parts: { label: string; png: Buffer }[]) {
  const variant = test.info().project.name;
  const dark = variant.endsWith("dark");
  const rows = parts
    .map(
      (p) =>
        `<figure><figcaption>${p.label}</figcaption><img src="data:image/png;base64,${p.png.toString("base64")}"></figure>`,
    )
    .join("");
  await page.setContent(
    `<html><body style="margin:0;background:${dark ? "#0b0f14" : "#f2f4f3"};color:${dark ? "#e7ecef" : "#1b1f23"};font:600 13px system-ui,sans-serif">
      <style>figure{margin:0 0 10px}figcaption{padding:8px 12px 4px}img{display:block;width:100%}</style>${rows}</body></html>`,
  );
  mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${name}-${variant}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await test.info().attach(name, { path: file, contentType: "image/png" });
}

/** 下から高さ height の帯を撮って返す */
export async function bottomStrip(page: Page, height = 170): Promise<Buffer> {
  await settle(page);
  const vp = page.viewportSize()!;
  return page.screenshot({
    clip: { x: 0, y: vp.height - height, width: vp.width, height },
    animations: "disabled",
    caret: "hide",
    style: "[data-sonner-toaster]{display:none !important}",
  });
}

/**
 * 共有の選び方。新しい形(「共有」の行を押して一覧から選ぶ)を先に試し、無ければ古い形(並んだ丸)を押す。
 * @returns 選べたら true
 */
export async function pickShare(page: Page, host: Locator, name: string): Promise<boolean> {
  const row = host.getByRole("button", { name: /^共有/ });
  if (await visible(row, 1_500)) {
    await row.first().click();
    const picker = page.getByRole("dialog", { name: "共有する相手" });
    const option = picker.getByRole("radio", { name });
    if (await visible(option)) {
      await option.click();
      await expect(picker).toBeHidden();
      return true;
    }
    // その機能をグループで足していないと、相手に出てこない
    await page.keyboard.press("Escape");
    await expect(picker).toBeHidden();
    return false;
  }
  const radio = host.getByRole("radio", { name });
  if (await visible(radio, 1_500)) {
    await radio.first().click();
    return true;
  }
  return false;
}

/**
 * 機能を足す。新しい形(「機能を足す」の画面)を先に試し、無ければ古い形(/extensions のトグル)を試す。
 * @returns 足せた、もう足してあった、なら true。その版に無ければ false
 */
export async function enableExtension(page: Page, label: string): Promise<boolean> {
  await page.goto("/settings/extensions/add");
  if (await visible(page.getByRole("heading", { name: "機能を足す" }), 5_000)) {
    const card = page.getByRole("region", { name: label, exact: true });
    if (!(await visible(card))) {
      // すでに足してあれば、機能の一覧にタイルがある
      await page.goto("/settings/extensions");
      return visible(page.getByRole("link", { name: label, exact: true }));
    }
    const add = card.getByRole("button", { name: "足す" });
    if (!(await visible(add, 1_000))) return true;
    await add.click();
    await expect(page).toHaveURL(/\/settings\/extensions$/);
    return true;
  }
  await page.goto("/extensions");
  const toggle = page.getByRole("switch", { name: `${label}を使う` });
  if (!(await visible(toggle, 5_000))) return false;
  if ((await toggle.getAttribute("aria-checked")) !== "true") await toggle.click();
  await expect(toggle).toBeChecked();
  return true;
}

/** カレンダーの下の帯の「予定を足す」を押し、新しい予定のシートを返す */
export async function openNewEvent(page: Page) {
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await expect(sheet).toBeVisible();
  return sheet;
}
