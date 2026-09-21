import { expect, test } from "@playwright/test";
import { apiUser, dayPanel, signUp } from "./helpers";

/** 日本時間の今日の正午。ミリ秒の UTC */
function tokyoNoonToday(): number {
  const day = 86_400_000;
  const hour = 3_600_000;
  return Math.floor((Date.now() + 9 * hour) / day) * day - 9 * hour + 12 * hour;
}

test("読み直しのボタンは誰にでも出て、押すとグループのほかの人が足した予定が出る", async ({ page, request }) => {
  // 相手が API でグループを作り、招待を出す
  const partner = await apiUser(request);
  await request.get("/api/me", { headers: partner.headers });
  await request.post("/api/me/agreements", { headers: partner.headers, data: { agreed: true } });
  const group = await (await request.post("/api/groups", { headers: partner.headers, data: { name: "ふたり" } })).json();
  const invite = await (await request.post(`/api/groups/${group.id}/invites`, { headers: partner.headers })).json();

  // 自分は画面から登録し、招待から参加する
  await signUp(page);
  await page.goto(`/invite/${invite.token}`);
  await page.getByRole("button", { name: "参加する" }).click();
  await expect(page.getByRole("region", { name: "月の表" })).toBeVisible();

  const refresh = page.getByRole("button", { name: "カレンダーを読み直す" });
  await expect(refresh).toBeVisible();
  await expect(refresh).toHaveAttribute("title", "カレンダーを読み直す");
  await expect(dayPanel(page).getByRole("button", { name: /相手の買い物/ })).toHaveCount(0);

  // 相手が予定を足す。画面は自動では追いかけない
  const startsAt = tokyoNoonToday();
  const created = await request.post("/api/events", {
    headers: partner.headers,
    data: { groupId: group.id, title: "相手の買い物", allDay: false, startsAt, endsAt: startsAt + 3_600_000, memo: null },
  });
  expect(created.status()).toBe(201);

  // 読み込み直さず、ボタンで出す
  await refresh.click();
  await expect(page.getByText("カレンダーを読み直しました")).toBeVisible();
  await expect(dayPanel(page).getByRole("button", { name: /相手の買い物/ })).toBeVisible();
  await expect(refresh).toBeEnabled();
});
