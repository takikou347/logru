import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { apiUser, dayPanel, signUp } from "./helpers";

/** 手元の開発のときだけ Worker が配る、見本の iCal。今日の打ち合わせ、明日からの旅行、毎週の読書会が入る */
const SAMPLE_PATH = "/api/external-calendars/__test__/sample.ics";

/** 設定の画面から、外部のカレンダーを 1 つ登録する */
async function register(page: Page, name: string, url: string) {
  await page.goto("/settings/extensions/external");
  const section = page.getByRole("region", { name: "外部のカレンダー" });
  await section.getByRole("button", { name: "カレンダーを登録する" }).click();
  const sheet = page.getByRole("dialog", { name: "外部のカレンダーを登録する" });
  await sheet.getByLabel("名前").fill(name);
  await sheet.getByRole("radio", { name: "藤" }).click();
  await sheet.getByLabel("iCal 形式の非公開 URL").fill(url);
  await sheet.getByRole("button", { name: "登録する" }).click();
  await expect(sheet).toBeHidden();
  return section;
}

/** API から、規約に同意した利用者を作る */
async function agreedUser(request: APIRequestContext) {
  const user = await apiUser(request);
  await request.get("/api/me", { headers: user.headers });
  await request.post("/api/me/agreements", { headers: user.headers, data: { agreed: true } });
  return user;
}

test("非公開の URL を登録すると、予定が選んだ色で出て、読むだけで直せない", async ({ page, baseURL }) => {
  await signUp(page);
  const section = await register(page, "プライベート", `${baseURL}${SAMPLE_PATH}`);
  await expect(page.getByText("プライベート を登録しました")).toBeVisible();
  const row = section.getByRole("listitem").filter({ hasText: "プライベート" });
  await expect(row).toContainText(new URL(baseURL!).host);
  await expect(row).toContainText("に読みました");
  // URL そのものは画面に出さない
  await expect(section).not.toContainText("sample.ics");

  await page.goto("/");
  const item = dayPanel(page).getByRole("button", { name: /外部の打ち合わせ/ });
  await expect(item).toContainText("プライベート");
  await expect(item.locator(".swatch-dot")).toHaveClass(/c-fuji/);

  await item.click();
  const sheet = page.getByRole("dialog", { name: "外部の打ち合わせ" });
  await expect(sheet).toContainText("10:00 から 11:00");
  await expect(sheet).toContainText("渋谷の会議室");
  await expect(sheet).toContainText("Google カレンダーで直してください");
  await expect(sheet.getByRole("button", { name: /消す|保存/ })).toHaveCount(0);
  await sheet.getByRole("button", { name: "閉じる" }).first().click();

  // 明日からの終日の旅行は、あさっても終日として出る
  await page.goto(`/?date=${tokyoDateKey(2)}`);
  await expect(dayPanel(page).getByRole("button", { name: /外部の旅行/ })).toContainText("終日");
});

/** 日本時間の今日から n 日後を、URL の date の形にする */
function tokyoDateKey(n: number): string {
  return new Date(Date.now() + 9 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);
}

test("読み直し、登録を消すと、取り込んだ予定も消える", async ({ page, baseURL }) => {
  await signUp(page);
  const section = await register(page, "しごと", `${baseURL}${SAMPLE_PATH}`);
  await section.getByRole("button", { name: "しごと を今すぐ読み直す" }).click();
  await expect(page.getByText("しごと を読み直しました")).toBeVisible();

  await page.goto("/");
  await expect(dayPanel(page).getByRole("button", { name: /外部の打ち合わせ/ })).toBeVisible();

  await page.goto("/settings/extensions/external");
  await section.getByRole("button", { name: "しごと の登録を消す" }).click();
  await page.getByRole("dialog", { name: "しごと の登録を消す" }).getByRole("button", { name: "登録を消す" }).click();
  await expect(section.getByText("まだ登録していません。")).toBeVisible();

  await page.goto("/");
  await expect(dayPanel(page)).toBeVisible();
  await expect(dayPanel(page).getByRole("button", { name: /外部の打ち合わせ/ })).toHaveCount(0);
});

test("カレンダーの読み直しのボタンを押すと、外部のカレンダーも読み直す", async ({ page, baseURL }) => {
  await signUp(page);
  await register(page, "プライベート", `${baseURL}${SAMPLE_PATH}`);
  await page.goto("/");
  const syncs: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/api/external-calendars/sync")) syncs.push(r.url());
  });
  // 外部のカレンダーを読み直す要求が 1 回出て、予定が出たままであることを確かめる
  await page.getByRole("button", { name: "カレンダーを読み直す" }).click();
  await expect(page.getByText("カレンダーを読み直しました")).toBeVisible();
  expect(syncs).toHaveLength(1);
  await expect(dayPanel(page).getByRole("button", { name: /外部の打ち合わせ/ })).toBeVisible();
});

test("外部のカレンダーが読めなければ、読み直しの知らせにその名前を出す", async ({ page, baseURL }) => {
  await signUp(page);
  await register(page, "古い URL", `${baseURL}/api/external-calendars/__test__/missing.ics`);
  await page.goto("/");
  await page.getByRole("button", { name: "カレンダーを読み直す" }).click();
  await expect(page.getByText("カレンダーを読み直しました。読めなかったもの: 古い URL")).toBeVisible();
});

test("外部のカレンダーを登録していなければ、外部のカレンダーは読みに行かない", async ({ page }) => {
  await signUp(page);
  const syncs: string[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/api/external-calendars/sync")) syncs.push(r.url());
  });
  await page.getByRole("button", { name: "カレンダーを読み直す" }).click();
  await expect(page.getByText("カレンダーを読み直しました")).toBeVisible();
  expect(syncs).toHaveLength(0);
});

test("https でない URL は断り、読めない URL は登録して理由を出す", async ({ page, baseURL }) => {
  await signUp(page);
  await page.goto("/settings/extensions/external");
  const section = page.getByRole("region", { name: "外部のカレンダー" });
  await section.getByRole("button", { name: "カレンダーを登録する" }).click();
  const sheet = page.getByRole("dialog", { name: "外部のカレンダーを登録する" });
  await sheet.getByLabel("名前").fill("だめ");
  await sheet.getByLabel("iCal 形式の非公開 URL").fill("http://example.com/basic.ics");
  await sheet.getByRole("button", { name: "登録する" }).click();
  await expect(sheet.getByText("https:// から始まる URL だけを登録できます。")).toBeVisible();
  await sheet.getByRole("button", { name: "やめる" }).click();

  await register(page, "古い URL", `${baseURL}/api/external-calendars/__test__/missing.ics`);
  const row = section.getByRole("listitem").filter({ hasText: "古い URL" });
  await expect(row.getByRole("alert")).toContainText("カレンダーが見つかりません。");
});

test("取り込んだ予定は本人だけに出て、グループの拡張の切り替えにも出ない。退会すると登録も消える", async ({
  request,
  baseURL,
}) => {
  const owner = await agreedUser(request);
  const other = await agreedUser(request);
  const created = await request.post("/api/external-calendars", {
    headers: owner.headers,
    data: { name: "見本", color: "asagi", url: `${baseURL}${SAMPLE_PATH}` },
  });
  expect(created.status()).toBe(201);
  const body = (await created.json()) as Record<string, unknown>;
  expect(body).not.toHaveProperty("url");
  expect(body).not.toHaveProperty("urlEncrypted");
  expect(body.lastError).toBeNull();

  const from = Date.now() - 86_400_000;
  const to = Date.now() + 7 * 86_400_000;
  const mine = await (await request.get(`/api/calendar?from=${from}&to=${to}`, { headers: owner.headers })).json();
  expect(mine.items.some((i: { extension: string }) => i.extension === "external")).toBe(true);
  const theirs = await (await request.get(`/api/calendar?from=${from}&to=${to}`, { headers: other.headers })).json();
  expect(theirs.items.some((i: { extension: string }) => i.extension === "external")).toBe(false);

  // ほかの人は、読み直しも消すこともできない
  const id = body.id as string;
  expect((await request.post(`/api/external-calendars/${id}/sync`, { headers: other.headers })).status()).toBe(404);
  expect((await request.delete(`/api/external-calendars/${id}`, { headers: other.headers })).status()).toBe(404);

  const { groups } = await (await request.get("/api/groups", { headers: owner.headers })).json();
  const ext = await (await request.get(`/api/groups/${groups[0].id}/extensions`, { headers: owner.headers })).json();
  expect(ext.extensions.map((x: { key: string }) => x.key)).not.toContain("external");

  // 退会すると、登録した行も消える。同じトークンで入り直すと、まっさらになっている
  const deleted = await request.delete("/api/me", { headers: owner.headers, data: { confirm: "削除する" } });
  expect(deleted.status()).toBe(204);
  await request.get("/api/me", { headers: owner.headers });
  await request.post("/api/me/agreements", { headers: owner.headers, data: { agreed: true } });
  const after = await (await request.get("/api/external-calendars", { headers: owner.headers })).json();
  expect(after.calendars).toEqual([]);
});
