import { expect, test } from "@playwright/test";
import { apiUser } from "./helpers";

/** LINE などへ貼ったときのカード。招待リンクだけ Worker が文言を書き換える。DB は読まず、グループの名前は出さない。#93 */

test("ホームの OG タグに、アプリの一行説明が入る", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Logru");
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    "content",
    "カレンダーを土台に、使いたい機能だけを足して使うアプリ。",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/og-image\.png$/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
});

// LINE の下見のサーバーは JS を動かさない。ここでも request で HTML そのものを見て確かめる
test("招待リンクの OG タグは、グループの名前を出さずに招待の文言になる", async ({ request }) => {
  const { headers } = await apiUser(request);
  await request.post("/api/me/agreements", { headers, data: { agreed: true } });
  const created = await request.post("/api/groups", { headers, data: { name: "ひみつのグループ名" } });
  const { id } = (await created.json()) as { id: string };
  const invited = await request.post(`/api/groups/${id}/invites`, { headers });
  const { url } = (await invited.json()) as { url: string };

  const res = await request.get(new URL(url).pathname);
  const html = await res.text();
  expect(html).toContain('<meta property="og:title" content="Logru への招待" />');
  expect(html).toContain('<meta property="og:description" content="Logru への招待が届いています。" />');
  expect(html).toContain(`<meta property="og:url" content="${url}" />`);
  expect(html).toMatch(/<meta property="og:image" content="[^"]+\/og-image\.png" \/>/);
  expect(html).not.toContain("ひみつのグループ名");
});
