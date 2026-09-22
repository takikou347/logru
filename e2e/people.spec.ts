import { type Page, expect, test } from "@playwright/test";
import { addEvent, apiUser, dayPanel, logIn, signUp } from "./helpers";

/** スマホの「人」のボタンからシートを開き、「ふたり」のまとまりでその人の印を押して閉じる */
async function togglePerson(page: Page, name: string) {
  await page.getByRole("navigation", { name: "グループで絞る" }).getByRole("button", { name: "表示する人" }).click();
  const sheet = page.getByRole("dialog", { name: "表示する人" });
  await sheet.getByRole("group", { name: "ふたり のメンバー" }).getByRole("button", { name, exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
}

test("相手の印を外すと相手の予定が消え、読み込み直しても別の端末でも同じ。相手の画面は変わらない", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const kota = await signUp(page, { name: "こた" });
  await page.goto("/groups");
  await page.getByLabel("グループの名前").fill("ふたり");
  await page.getByRole("button", { name: "作る" }).click();
  await page.getByRole("button", { name: "招待リンクを作る" }).click();
  const path = new URL(await page.getByLabel("招待リンク").inputValue()).pathname;

  const partnerContext = await browser.newContext();
  const partner = await partnerContext.newPage();
  await signUp(partner, { name: "みか", next: path });
  await partner.getByRole("button", { name: "参加する" }).click();
  await expect(partner).toHaveURL(/group=/);
  await partner.goto("/");
  await addEvent(partner, "みかの予定", "ふたり");

  await page.goto("/");
  await addEvent(page, "こたの予定", "ふたり");
  const panel = dayPanel(page);
  await expect(panel.getByRole("button", { name: /みかの予定/ })).toBeVisible();

  // シートはグループごとのまとまりで、はじめから開いている。自分と相手が並び、両方とも出している
  await page.getByRole("navigation", { name: "グループで絞る" }).getByRole("button", { name: "表示する人" }).click();
  const sheet = page.getByRole("dialog", { name: "表示する人" });
  await expect(sheet.getByRole("button", { name: "ふたり", exact: true })).toHaveAttribute("aria-expanded", "true");
  const members = sheet.getByRole("group", { name: "ふたり のメンバー" });
  await expect(members.getByRole("button", { name: "自分", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(members.getByRole("button", { name: "みか", exact: true })).toHaveAttribute("aria-pressed", "true");

  // まとまりは閉じられ、開け閉めは次に開いたときも同じ
  await sheet.getByRole("button", { name: "ふたり", exact: true }).click();
  await expect(members).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("navigation", { name: "グループで絞る" }).getByRole("button", { name: "表示する人" }).click();
  await expect(sheet.getByRole("button", { name: "ふたり", exact: true })).toHaveAttribute("aria-expanded", "false");
  await sheet.getByRole("button", { name: "ふたり", exact: true }).click();
  await expect(members).toBeVisible();
  await page.keyboard.press("Escape");

  // 相手の印を外すと、相手が作った予定だけが消える
  await togglePerson(page, "みか");
  await expect(panel.getByRole("button", { name: /みかの予定/ })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: /こたの予定/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "グループで絞る" }).getByRole("button", { name: "表示する人" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // 読み込み直しても同じ
  await page.reload();
  await expect(panel.getByRole("button", { name: /こたの予定/ })).toBeVisible();
  await expect(panel.getByRole("button", { name: /みかの予定/ })).toHaveCount(0);

  // 別の端末でログインしても同じ
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await logIn(other, kota.email);
  await expect(dayPanel(other).getByRole("button", { name: /こたの予定/ })).toBeVisible();
  await expect(dayPanel(other).getByRole("button", { name: /みかの予定/ })).toHaveCount(0);
  await otherContext.close();

  // 相手の画面は変わらない
  await partner.reload();
  await expect(dayPanel(partner).getByRole("button", { name: /こたの予定/ })).toBeVisible();
  await expect(dayPanel(partner).getByRole("button", { name: /みかの予定/ })).toBeVisible();

  // 印を戻すと出る
  await togglePerson(page, "みか");
  await expect(panel.getByRole("button", { name: /みかの予定/ })).toBeVisible();

  // 自分の印を外すと、自分が作った予定が消える
  await togglePerson(page, "自分");
  await expect(panel.getByRole("button", { name: /こたの予定/ })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: /みかの予定/ })).toBeVisible();

  await partnerContext.close();
});

test("同じグループにいない人は選べない", async ({ request }) => {
  const a = await apiUser(request);
  const b = await apiUser(request);
  for (const u of [a, b]) {
    await request.post("/api/me/agreements", { headers: u.headers, data: { agreed: true } });
  }
  const me = await (await request.get("/api/me", { headers: b.headers })).json();
  const res = await request.put(`/api/me/visibility/${me.user.id}`, { headers: a.headers, data: { hidden: true } });
  expect(res.status()).toBe(404);
  const own = await (await request.get("/api/me", { headers: a.headers })).json();
  expect(own.hiddenMembers).toEqual([]);
});
