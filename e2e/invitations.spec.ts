import { type APIRequestContext, type Browser, expect, type Page, test } from "@playwright/test";
import { apiUser, dayPanel, pickShare, signUp } from "./helpers";

/**
 * 「ふたり」のグループを作り、ほかの人を招待リンクで入れる。人ごとに別の端末で開く
 * @returns 入った人の画面。names の順
 */
async function shareGroup(page: Page, browser: Browser, names: string[]) {
  await signUp(page, { name: "こた" });
  await page.goto("/groups");
  await page.getByLabel("グループの名前").fill("ふたり");
  await page.getByRole("button", { name: "作る" }).click();
  await page.getByRole("button", { name: "招待リンクを作る" }).click();
  const path = new URL(await page.getByLabel("招待リンク").inputValue()).pathname;
  const others: Page[] = [];
  for (const name of names) {
    const other = await (await browser.newContext()).newPage();
    await signUp(other, { name, next: path });
    await other.getByRole("button", { name: "参加する" }).click();
    await expect(other).toHaveURL(/group=/);
    await other.goto("/");
    others.push(other);
  }
  await page.goto("/");
  return others;
}

/** 下の操作から予定を足し、「ふたり」に置いて、names の人を招待する */
async function addInvited(page: Page, title: string, names: string[]) {
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const sheet = page.getByRole("dialog", { name: "新しい予定" });
  await sheet.getByLabel("題名").fill(title);
  await pickShare(page, sheet, "ふたり");
  const picker = sheet.getByRole("group", { name: "招待する人" });
  for (const name of names) await picker.getByRole("button", { name, exact: true }).click();
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予定を足しました")).toBeVisible();
}

/** 選んだ日の欄の予定。返事は data-response に出る */
const dayItem = (page: Page, title: string) => dayPanel(page).getByRole("button", { name: new RegExp(title) });

/** 予定のシートを開く。題名で探す */
async function openItem(page: Page, title: string) {
  await dayItem(page, title).click();
  return page.getByRole("dialog");
}

test("招待した相手には返事待ちの枠線で出て、参加すると塗り、参加しないと薄く取り消し線になる", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const [mika] = await shareGroup(page, browser, ["みか"]);

  // 共有しないときは、招待の欄を出さない
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  const draft = page.getByRole("dialog", { name: "新しい予定" });
  await expect(draft.getByRole("group", { name: "招待する人" })).toHaveCount(0);
  await pickShare(page, draft, "ふたり");
  await expect(draft.getByRole("group", { name: "招待する人" }).getByRole("button", { name: "全員" })).toBeVisible();
  await page.keyboard.press("Escape");

  await addInvited(page, "映画", ["みか"]);
  // 作った人の見た目は、いまと同じ塗り
  await expect(dayItem(page, "映画")).toHaveAttribute("data-response", "accepted");

  // 相手には返事待ちで出る。一覧には「返事待ち」と添え、月の表の点は輪だけにする
  await mika!.reload();
  await expect(dayItem(mika!, "映画")).toHaveAttribute("data-response", "pending");
  await expect(dayItem(mika!, "映画")).toContainText("返事待ち");
  await expect(
    mika!.getByRole("region", { name: "月の表" }).locator('[data-response="pending"]').first(),
  ).toBeAttached();

  // 相手がシートを開くと、上に返事の欄が出る。「参加する」を返すと塗る
  let sheet = await openItem(mika!, "映画");
  const rsvp = sheet.getByRole("region", { name: "招待への返事" });
  await expect(rsvp).toContainText("こたさんから招待されています");
  await expect(sheet.getByRole("button", { name: "予定を消す" })).toHaveCount(0);
  await rsvp.getByRole("button", { name: "参加する" }).click();
  await expect(mika!.getByText("参加すると返しました")).toBeVisible();
  await expect(rsvp.getByRole("button", { name: "参加する" })).toHaveAttribute("aria-pressed", "true");
  await mika!.keyboard.press("Escape");
  await expect(dayItem(mika!, "映画")).toHaveAttribute("data-response", "accepted");
  await expect(dayItem(mika!, "映画")).not.toContainText("返事待ち");

  // 作った人のシートの参加者の一覧に、相手の返事が出る
  await page.reload();
  sheet = await openItem(page, "映画");
  const list = sheet.getByRole("region", { name: "参加者" });
  await expect(list.getByRole("listitem").filter({ hasText: "みか" })).toContainText("参加する");
  await expect(list.getByRole("listitem").filter({ hasText: "自分" })).toContainText("作った人");
  await expect(sheet.getByRole("region", { name: "招待への返事" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // 返事は後から変えられる。「参加しない」なら薄く取り消し線
  sheet = await openItem(mika!, "映画");
  await sheet.getByRole("region", { name: "招待への返事" }).getByRole("button", { name: "参加しない" }).click();
  await expect(mika!.getByText("参加しないと返しました")).toBeVisible();
  await mika!.keyboard.press("Escape");
  await expect(dayItem(mika!, "映画")).toHaveAttribute("data-response", "declined");
  await expect(dayItem(mika!, "映画")).toHaveAccessibleName(/参加しない/);
  await expect(dayItem(mika!, "映画").locator(".line-through")).toBeVisible();

  await page.reload();
  sheet = await openItem(page, "映画");
  await expect(
    sheet.getByRole("region", { name: "参加者" }).getByRole("listitem").filter({ hasText: "みか" }),
  ).toContainText("参加しない");
});

test("招待された人は予定を直せ、直した内容は作った人にも出る。招待されていないメンバーは見るだけ", async ({
  page,
  browser,
}) => {
  test.setTimeout(150_000);
  const [mika, haha] = await shareGroup(page, browser, ["みか", "はは"]);
  await addInvited(page, "買い出し", ["みか"]);

  // 招待されたみかが題名を直す
  await mika!.reload();
  const sheet = await openItem(mika!, "買い出し");
  await expect(sheet).toHaveAccessibleName("予定を直す");
  await sheet.getByLabel("題名").fill("買い出しと夕飯");
  // グループを変えられるのは作った人だけ
  await expect(sheet.getByRole("button", { name: /^共有/ })).toBeDisabled();
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(mika!.getByText("予定を保存しました")).toBeVisible();

  await page.reload();
  await expect(dayItem(page, "買い出しと夕飯")).toBeVisible();

  // 招待しなかったははにも、グループの予定として見える。ただし見るだけ
  await haha!.reload();
  await expect(dayItem(haha!, "買い出しと夕飯")).toBeVisible();
  await expect(dayItem(haha!, "買い出しと夕飯")).not.toHaveAttribute("data-response");
  const readOnly = await openItem(haha!, "買い出しと夕飯");
  await expect(readOnly).toHaveAccessibleName("予定");
  await expect(readOnly.getByText("この予定は見るだけです。直せるのは、作った人と招待された人です。")).toBeVisible();
  await expect(readOnly.getByLabel("題名")).toBeDisabled();
  await expect(readOnly.getByRole("button", { name: "保存する" })).toHaveCount(0);
  await expect(readOnly.getByRole("button", { name: "予定を消す" })).toHaveCount(0);
  await expect(readOnly.getByRole("group", { name: "招待する人" })).toHaveCount(0);
  await expect(readOnly.getByRole("region", { name: "参加者" })).toContainText("みか");
  // 「閉じる」のボタンは、下の明示のボタンと、右上の X の読み上げ名がどちらも「閉じる」なので先頭を取る
  await readOnly.getByRole("button", { name: "閉じる" }).first().click();
  await expect(readOnly).toHaveCount(0);
});

test("「表示する人」で相手だけを出すと、相手が参加するか返事待ちの予定が出て、参加しないと返した予定は出ない", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const [mika] = await shareGroup(page, browser, ["みか"]);
  await addInvited(page, "旅行の相談", ["みか"]);
  await addInvited(page, "こただけの用事", []);

  // 自分の印を外し、みかだけを出す
  const nav = page.getByRole("navigation", { name: "グループで絞る" });
  await nav.getByRole("button", { name: "表示する人" }).click();
  const people = page.getByRole("dialog", { name: "表示する人" });
  await people
    .getByRole("group", { name: "ふたり のメンバー" })
    .getByRole("button", { name: "自分", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(dayItem(page, "旅行の相談")).toBeVisible();
  await expect(dayItem(page, "こただけの用事")).toHaveCount(0);

  // みかが参加しないと返すと、みかの予定ではなくなる
  await mika!.reload();
  const sheet = await openItem(mika!, "旅行の相談");
  await sheet.getByRole("region", { name: "招待への返事" }).getByRole("button", { name: "参加しない" }).click();
  await expect(mika!.getByText("参加しないと返しました")).toBeVisible();
  await page.reload();
  await expect(dayPanel(page)).toBeVisible();
  await expect(dayItem(page, "旅行の相談")).toHaveCount(0);
});

/** API だけで、同意済みの利用者を作る */
async function agreedUser(request: APIRequestContext) {
  const u = await apiUser(request);
  await request.post("/api/me/agreements", { headers: u.headers, data: { agreed: true } });
  const me = await (await request.get("/api/me", { headers: u.headers })).json();
  return { ...u, id: me.user.id as string };
}

test("API でも、招待できるのはグループのメンバーだけ。直せるのは作った人と招待された人、消せるのは作った人だけ", async ({
  request,
}) => {
  const [owner, invitee, member, outsider] = await Promise.all([1, 2, 3, 4].map(() => agreedUser(request)));
  const group = await (await request.post("/api/groups", { headers: owner.headers, data: { name: "ふたり" } })).json();
  const { token } = await (await request.post(`/api/groups/${group.id}/invites`, { headers: owner.headers })).json();
  for (const u of [invitee, member]) {
    expect((await request.post(`/api/invites/${token}/accept`, { headers: u.headers })).ok()).toBe(true);
  }
  const base = {
    groupId: group.id,
    title: "映画",
    allDay: false,
    startsAt: Date.now(),
    endsAt: Date.now() + 3_600_000,
    memo: null,
  };

  // グループの外の人は招待できない
  const outside = await request.post("/api/events", {
    headers: owner.headers,
    data: { ...base, attendeeIds: [outsider.id] },
  });
  expect(outside.status()).toBe(400);

  const created = await request.post("/api/events", {
    headers: owner.headers,
    data: { ...base, attendeeIds: [invitee.id] },
  });
  expect(created.status()).toBe(201);
  const event = await created.json();
  expect(event.myResponse).toBe("accepted");
  expect(event.attendees).toEqual([
    { userId: owner.id, response: "accepted" },
    { userId: invitee.id, response: "pending" },
  ]);

  // 直すときも、グループの外の人は招待できない
  const patchOutside = await request.patch(`/api/events/${event.id}`, {
    headers: invitee.headers,
    data: { attendeeIds: [outsider.id] },
  });
  expect(patchOutside.status()).toBe(400);

  // 招待されていないメンバーは読めるが、直せない、返事もできない
  const seen = await (await request.get(`/api/events/${event.id}`, { headers: member.headers })).json();
  expect(seen.title).toBe("映画");
  expect(seen.myResponse).toBeUndefined();
  expect(
    (await request.patch(`/api/events/${event.id}`, { headers: member.headers, data: { title: "x" } })).status(),
  ).toBe(403);
  expect(
    (
      await request.put(`/api/events/${event.id}/response`, { headers: member.headers, data: { response: "accepted" } })
    ).status(),
  ).toBe(403);
  expect((await request.delete(`/api/events/${event.id}`, { headers: member.headers })).status()).toBe(403);

  // グループの外の人は、ある予定かどうかも分からない
  expect((await request.get(`/api/events/${event.id}`, { headers: outsider.headers })).status()).toBe(404);

  // 招待された人は直せるが、消せない。グループも変えられない
  const edited = await request.patch(`/api/events/${event.id}`, {
    headers: invitee.headers,
    data: { title: "映画と夕飯", attendeeIds: [member.id] },
  });
  expect(edited.status()).toBe(200);
  const afterEdit = await edited.json();
  expect(afterEdit.title).toBe("映画と夕飯");
  // 招待を付け替えても、作った人は残る。外した自分は参加者から外れる
  expect(afterEdit.attendees.map((a: { userId: string }) => a.userId).sort()).toEqual([owner.id, member.id].sort());
  expect((await request.delete(`/api/events/${event.id}`, { headers: invitee.headers })).status()).toBe(403);

  // 作った人は、自分に返事をしない
  expect(
    (
      await request.put(`/api/events/${event.id}/response`, { headers: owner.headers, data: { response: "declined" } })
    ).status(),
  ).toBe(403);

  // 招待されたメンバーが返事をし、グループを抜けると参加者から外れる
  const answered = await request.put(`/api/events/${event.id}/response`, {
    headers: member.headers,
    data: { response: "accepted" },
  });
  expect((await answered.json()).myResponse).toBe("accepted");
  expect((await request.delete(`/api/groups/${group.id}/members/me`, { headers: member.headers })).status()).toBe(204);
  const afterLeave = await (await request.get(`/api/events/${event.id}`, { headers: owner.headers })).json();
  expect(afterLeave.attendees).toEqual([{ userId: owner.id, response: "accepted" }]);

  // 作った人は消せる
  expect((await request.delete(`/api/events/${event.id}`, { headers: owner.headers })).status()).toBe(204);
});
