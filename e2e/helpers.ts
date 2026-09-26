import { type APIRequestContext, expect, type Locator, type Page } from "@playwright/test";

/** Firebase の Auth エミュレーター。.env.test と同じ値 */
export const EMULATOR = "http://127.0.0.1:9099";
const PROJECT = "demo-logru";
const API_KEY = "demo-api-key";
const IDENTITY = `${EMULATOR}/identitytoolkit.googleapis.com/v1`;

let seq = 0;

/** テストごとに重ならないメールアドレスを作る */
export function uniqueEmail(prefix = "user"): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${process.pid}-${seq}@example.com`;
}

export const PASSWORD = "correct-horse-42";

/**
 * 日本時間の今日から、指定した日数だけ進んだ日の年・月・日と `yyyy-mm-dd` の形をまとめて返す。
 * CI は UTC で動くため、素の Date の getFullYear などを使うと、日本時間の「今日」とずれることがある
 */
export function tokyoDateParts(offsetDays = 0): { year: number; month: number; day: number; key: string } {
  const at = new Date(Date.now() + offsetDays * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    key: `${map.year}-${map.month}-${map.day}`,
  };
}

type OobCode = { email: string; requestType: "VERIFY_EMAIL" | "PASSWORD_RESET"; oobCode: string; oobLink: string };

/**
 * エミュレーターが送ったことにしたメールから、宛先に届いた最新のものを取り出す。
 * エミュレーターは本当には送らず、ここに控えを残す。
 */
export async function latestOob(
  request: APIRequestContext,
  email: string,
  type: OobCode["requestType"],
): Promise<OobCode> {
  let found: OobCode | undefined;
  await expect
    .poll(
      async () => {
        const res = await request.get(`${EMULATOR}/emulator/v1/projects/${PROJECT}/oobCodes`);
        const { oobCodes } = (await res.json()) as { oobCodes: OobCode[] };
        found = oobCodes.filter((c) => c.email === email && c.requestType === type).at(-1);
        return found;
      },
      { timeout: 10_000 },
    )
    .toBeTruthy();
  return found!;
}

/** 登録の画面を埋めて送る。確認メールを開く前で止まる */
export async function submitSignUp(
  page: Page,
  opts: { name?: string; email?: string; next?: string; agree?: boolean } = {},
) {
  const email = opts.email ?? uniqueEmail();
  const name = opts.name ?? "テスト";
  await page.goto(opts.next ? `/signup?next=${encodeURIComponent(opts.next)}` : "/signup");
  await page.getByLabel("表示名").fill(name);
  await page.getByLabel("メールアドレス", { exact: true }).fill(email);
  await page.getByLabel("パスワード", { exact: true }).fill(PASSWORD);
  if (opts.agree !== false) await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "登録する" }).click();
  return { email, name };
}

/**
 * 画面から登録し、確認メールのリンクを開いて、次の画面まで進む。
 * next が無ければ、カレンダーが出るまで待つ。
 */
export async function signUp(page: Page, opts: { name?: string; email?: string; next?: string } = {}) {
  const user = await submitSignUp(page, opts);
  await expect(page.getByRole("heading", { name: "確認メールを送りました" })).toBeVisible();
  const { oobLink } = await latestOob(page.request, user.email, "VERIFY_EMAIL");
  await page.request.get(oobLink);
  await page.getByRole("button", { name: "確かめた" }).click();
  if (!opts.next) await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();
  return user;
}

/** ログインの画面から、メールとパスワードで入る */
export async function logIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("メールアドレス", { exact: true }).fill(email);
  await page.getByLabel("パスワード", { exact: true }).fill(password);
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
}

/** 見えているほうのアカウントのメニューを開く。スマホは上の帯、PC は左の列にある */
export async function openAccountMenu(page: Page) {
  await page.getByRole("button", { name: "アカウントのメニュー" }).filter({ visible: true }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  return menu;
}

/** アカウントのメニューからログアウトし、ログインの画面に移るまで待つ */
export async function logOut(page: Page) {
  const menu = await openAccountMenu(page);
  await menu.getByRole("menuitem", { name: "ログアウト" }).click();
  await expect(page).toHaveURL(/\/login/);
}

/** エミュレーターの管理者として、利用者を書き換える */
async function adminUpdate(request: APIRequestContext, body: Record<string, unknown>) {
  const res = await request.post(`${IDENTITY}/projects/${PROJECT}/accounts:update`, {
    headers: { Authorization: "Bearer owner" },
    data: body,
  });
  expect(res.ok()).toBe(true);
}

/**
 * 画面を通さずに利用者を作り、API に付ける ID トークンを返す。サーバーの守りを確かめるときに使う。
 * @param verified メールアドレスを確かめたことにするか
 */
export async function apiUser(request: APIRequestContext, { verified = true } = {}) {
  const email = uniqueEmail("api");
  const created = await request.post(`${IDENTITY}/accounts:signUp?key=${API_KEY}`, {
    data: { email, password: PASSWORD, returnSecureToken: true },
  });
  const { localId } = (await created.json()) as { localId: string };
  if (verified) await adminUpdate(request, { localId, emailVerified: true });
  const signedIn = await request.post(`${IDENTITY}/accounts:signInWithPassword?key=${API_KEY}`, {
    data: { email, password: PASSWORD, returnSecureToken: true },
  });
  const { idToken } = (await signedIn.json()) as { idToken: string };
  return { email, headers: { Authorization: `Bearer ${idToken}` } };
}

/** 再設定のメールのコードで、パスワードを変える。Firebase の画面の代わり */
export async function resetPassword(request: APIRequestContext, oobCode: string, newPassword: string) {
  const res = await request.post(`${IDENTITY}/accounts:resetPassword?key=${API_KEY}`, {
    data: { oobCode, newPassword },
  });
  expect(res.ok()).toBe(true);
}

/** 選んだ日の予定の欄 */
export const dayPanel = (page: Page) => page.getByTestId("day-panel");

/**
 * タッチの横のスワイプを起こす。月送りの日めくり(#99)のように、指の動きを追う操作を確かめるのに使う。
 * @param dx 動かす向きと幅。負なら左(次へ)、正なら右(前へ)
 * @param steps 途中の touchmove の回数。多いほど、指がゆっくり動いたことになる
 */
export async function swipeHorizontal(target: Locator, dx: number, steps = 8) {
  const box = (await target.boundingBox())!;
  const startX = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const point = (x: number) => ({ identifier: 1, clientX: x, clientY: y });
  await target.dispatchEvent("touchstart", { touches: [point(startX)], changedTouches: [point(startX)] });
  for (let i = 1; i <= steps; i++) {
    const x = startX + (dx * i) / steps;
    await target.dispatchEvent("touchmove", { touches: [point(x)], changedTouches: [point(x)] });
  }
  const endX = startX + dx;
  await target.dispatchEvent("touchend", { touches: [], changedTouches: [point(endX)] });
}

/**
 * 指で押して引いて離す。CDP の Input.dispatchTouchEvent を直に呼ぶ。持ち手のドラッグは
 * Pointer Events の pointer capture を使うため、DOM に合成イベントを投げるだけでは
 * ブラウザが「押されている指」を認識せず捕まらない。実の入力として扱わせるため CDP を使う。#121
 */
export async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 8) {
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from.x, y: from.y }] });
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
  }
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

/**
 * 行を左へ dx だけ引く。SwipeRow(0084、#225)の swipe を、touchDrag と同じ CDP の指で試す。
 * @param row 引く行(li など)の locator
 * @param dx 引く距離(px)。行の幅の 6 割ほどで「消す」まで引き切る
 */
export async function swipeRowLeft(page: Page, row: Locator, dx: number) {
  const box = await row.boundingBox();
  if (!box) throw new Error("行の位置が取れなかった");
  const y = box.y + box.height / 2;
  const startX = box.x + box.width - 16;
  await touchDrag(page, { x: startX, y }, { x: startX - dx, y });
}

/**
 * 「機能を足す」画面で、指定した機能を自分だけで使えるようにする。issue #145
 * @param label 拡張の manifest.label(カードの見出し)
 */
export async function addExtension(page: Page, label: string) {
  await page.goto("/settings/extensions/add");
  await page.getByRole("region", { name: label }).getByRole("button", { name: "足す" }).click();
  await expect(page).toHaveURL(/\/settings\/extensions$/);
}

/**
 * 設定の「機能」で、並びを変える状態にしてから指定した機能を外す。issue #145
 * @param label タイルの名前(nav の名前、無ければ manifest の名前)
 */
export async function removeExtension(page: Page, label: string) {
  await page.goto("/settings/extensions");
  await page.getByRole("button", { name: "並びを変える" }).click();
  await page.getByRole("button", { name: `${label}を外す` }).click();
  const confirm = page.getByRole("dialog", { name: `${label}を外しますか` });
  await confirm.getByRole("button", { name: "外す" }).click();
  // 外した知らせが出るまで待ち、サーバーの書き込みが終わってから戻す
  await expect(page.getByText(`${label}を外しました`)).toBeVisible();
  await expect(confirm).toBeHidden();
}

/**
 * 「共有」の選ぶ行を押し、開いた「共有する相手」の一覧から選ぶ。0057
 * @param host シートかダイアログ。行を探す範囲
 * @param name 選ぶ相手の名前。「共有しない」「自分だけ」も使える
 */
export async function pickShare(page: Page, host: Locator, name: string) {
  await host.getByRole("button", { name: /^共有/ }).click();
  await page.getByRole("dialog", { name: "共有する相手" }).getByRole("radio", { name }).click();
}

/**
 * カレンダーの下の操作から、予定を 1 件足す。
 * @param group 共有するグループの名前。無ければ「共有しない」のまま保存する
 */
export async function addEvent(page: Page, title: string, group?: string) {
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await sheet.getByLabel("題名").fill(title);
  if (group) await pickShare(page, sheet, group);
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予定を足しました")).toBeVisible();
}

/**
 * 思い出の画面で、記録するか思い出を作るを始める。記録するは下の「+」を直に押し、
 * 思い出を作るは見出しの右のボタンを押す。#164
 */
export async function addMemories(page: Page, option: "記録する" | "思い出を作る") {
  if (option === "記録する") {
    await page.getByRole("toolbar", { name: "思い出の操作" }).getByRole("button", { name: "記録する" }).click();
  } else {
    await page.getByRole("button", { name: "思い出を作る" }).click();
  }
}
