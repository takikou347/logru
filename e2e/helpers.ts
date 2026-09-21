import { type APIRequestContext, type Page, expect } from "@playwright/test";

let seq = 0;

/** テストごとに重ならないメールアドレスを作る */
export function uniqueEmail(prefix = "user"): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${process.pid}-${seq}@example.com`;
}

export const PASSWORD = "correct-horse-42";

/** 開発用の控えから、宛先に届いた最新のメールのリンクを取り出す */
export async function latestMailLink(request: APIRequestContext, to: string, subject: RegExp): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const res = await request.get(`/api/dev/mails?to=${encodeURIComponent(to)}`);
        const { mails } = (await res.json()) as { mails: { subject: string; text: string }[] };
        const mail = mails.find((m) => subject.test(m.subject));
        link = mail?.text.match(/https?:\/\/\S+/)?.[0];
        return link;
      },
      { timeout: 10_000 },
    )
    .toBeTruthy();
  return link!;
}

/** 画面から登録し、確認メールのリンクを開いてカレンダーまで進む */
export async function signUp(page: Page, opts: { name?: string; email?: string; next?: string } = {}) {
  const email = opts.email ?? uniqueEmail();
  const name = opts.name ?? "テスト";
  await page.goto(opts.next ? `/signup?next=${encodeURIComponent(opts.next)}` : "/signup");
  await page.getByLabel("表示名").fill(name);
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: "確認メールを送りました" })).toBeVisible();
  const link = await latestMailLink(page.request, email, /確かめて/);
  await page.goto(link);
  return { email, name };
}

export async function logIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(password);
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
}

/** カレンダーの下の操作から、予定を 1 件足す */
export async function addEvent(page: Page, title: string, group?: string) {
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await sheet.getByLabel("題名").fill(title);
  if (group) await sheet.getByRole("radio", { name: group }).click();
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予定を足しました")).toBeVisible();
}
