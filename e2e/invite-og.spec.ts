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

test("招待リンクの OG タグは、グループの名前を出さずに招待の文言になる", async ({ page, request }) => {
  const { headers } = await apiUser(request);
  await request.post("/api/me/agreements", { headers, data: { agreed: true } });
  const created = await request.post("/api/groups", { headers, data: { name: "ひみつのグループ名" } });
  const { id } = (await created.json()) as { id: string };
  const invited = await request.post(`/api/groups/${id}/invites`, { headers });
  const { url } = (await invited.json()) as { url: string };

  await page.goto(new URL(url).pathname);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Logru への招待");
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    "content",
    "Logru への招待が届いています。",
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", page.url());
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/og-image\.png$/);
  expect(await page.content()).not.toContain("ひみつのグループ名");
});
