import { type APIRequestContext, expect, type Page } from "@playwright/test";

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
 * カレンダーの下の操作から、予定を 1 件足す。
 * @param group 共有するグループの名前。無ければ「共有しない」のまま保存する
 */
export async function addEvent(page: Page, title: string, group?: string) {
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await sheet.getByLabel("題名").fill(title);
  if (group) await sheet.getByRole("radio", { name: group }).click();
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予定を足しました")).toBeVisible();
}
