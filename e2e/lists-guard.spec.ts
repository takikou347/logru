import { type APIRequestContext, expect, test } from "@playwright/test";
import { apiUser } from "./helpers";

/** 規約に同意し、自分だけのグループでリストを使えるようにした利用者 */
async function listsUser(request: APIRequestContext) {
  const user = await apiUser(request);
  await request.post("/api/me/agreements", { headers: user.headers, data: { agreed: true } });
  const { personalGroupId } = await (await request.get("/api/extensions", { headers: user.headers })).json();
  const on = await request.put(`/api/groups/${personalGroupId}/extensions/lists`, {
    headers: user.headers,
    data: { enabled: true },
  });
  expect(on.status()).toBe(200);
  return { ...user, groupId: personalGroupId as string };
}

test("ほかの人のリストは見えない。グループの外からは作れない", async ({ request }) => {
  const a = await listsUser(request);
  const b = await listsUser(request);
  const created = await request.post("/api/lists", {
    headers: a.headers,
    data: { groupId: a.groupId, title: "買い物" },
  });
  expect(created.status()).toBe(201);
  const list = await created.json();

  // 別の人が同じグループのリストを読もうとしても、メンバーでなければ見えない
  const denied = await request.get(`/api/lists/${list.id}`, { headers: b.headers });
  expect(denied.status()).toBe(404);
  const deniedList = await request.get(`/api/lists?group=${a.groupId}`, { headers: b.headers });
  expect(deniedList.status()).toBe(404);

  // グループを指定しなければ、自分の使えるグループだけの一覧になる。ほかの人のリストは混ざらない
  const bAll = await (await request.get("/api/lists", { headers: b.headers })).json();
  expect(bAll.lists).toHaveLength(0);

  // ほかの人のグループにはリストを作れない
  const deniedCreate = await request.post("/api/lists", {
    headers: b.headers,
    data: { groupId: a.groupId, title: "横取り" },
  });
  expect(deniedCreate.status()).toBe(404);

  // グループの外からは、項目も足せない、直すことも消すこともできない。見えないのと同じ 404
  const deniedAddItem = await request.post(`/api/lists/${list.id}/items`, {
    headers: b.headers,
    data: { text: "にんじん" },
  });
  expect(deniedAddItem.status()).toBe(404);
  const deniedPatch = await request.patch(`/api/lists/${list.id}`, { headers: b.headers, data: { title: "x" } });
  expect(deniedPatch.status()).toBe(404);
  const deniedDelete = await request.delete(`/api/lists/${list.id}`, { headers: b.headers });
  expect(deniedDelete.status()).toBe(404);
});

test("同じグループのメンバーなら、足した人でなくても直せる、消せる。0054", async ({ request }) => {
  const owner = await listsUser(request);
  const member = await listsUser(request);
  const group = await (await request.post("/api/groups", { headers: owner.headers, data: { name: "ふたり" } })).json();
  await request.put(`/api/groups/${group.id}/extensions/lists`, { headers: owner.headers, data: { enabled: true } });
  const { token } = await (await request.post(`/api/groups/${group.id}/invites`, { headers: owner.headers })).json();
  expect((await request.post(`/api/invites/${token}/accept`, { headers: member.headers })).ok()).toBe(true);

  const created = await request.post("/api/lists", {
    headers: owner.headers,
    data: { groupId: group.id, title: "買い出し" },
  });
  const list = await created.json();
  const item = await (
    await request.post(`/api/lists/${list.id}/items`, { headers: owner.headers, data: { text: "にんじん" } })
  ).json();

  // メンバーなので、一覧にも項目にも出る
  const detail = await (await request.get(`/api/lists/${list.id}`, { headers: member.headers })).json();
  expect(detail.items).toHaveLength(1);

  // 足した人でなくても、項目をチェックできる。F-204
  const checked = await request.patch(`/api/lists/${list.id}/items/${item.id}`, {
    headers: member.headers,
    data: { checked: true },
  });
  expect(checked.status()).toBe(200);
  expect((await checked.json()).checked).toBe(true);

  // 足した人でなくても、項目を消せる。F-205
  const deleted = await request.delete(`/api/lists/${list.id}/items/${item.id}`, { headers: member.headers });
  expect(deleted.status()).toBe(204);

  // 作った人でなくても、リストの名前を直せる。F-206
  const patched = await request.patch(`/api/lists/${list.id}`, {
    headers: member.headers,
    data: { title: "週末の買い出し" },
  });
  expect(patched.status()).toBe(200);
  expect((await patched.json()).title).toBe("週末の買い出し");
});

test("拡張を無効にしたグループは、読めなくなるがデータは消えない", async ({ request }) => {
  const a = await listsUser(request);
  await request.post("/api/lists", { headers: a.headers, data: { groupId: a.groupId, title: "買い物" } });
  await request.put(`/api/groups/${a.groupId}/extensions/lists`, { headers: a.headers, data: { enabled: false } });
  const off = await (await request.get("/api/lists", { headers: a.headers })).json();
  expect(off.lists).toHaveLength(0);

  await request.put(`/api/groups/${a.groupId}/extensions/lists`, { headers: a.headers, data: { enabled: true } });
  const on = await (await request.get("/api/lists", { headers: a.headers })).json();
  expect(on.lists).toHaveLength(1);
});

test("項目を足す、チェックすると一覧の残りの数に反映される。F-201、F-202、F-203、F-204", async ({ request }) => {
  const a = await listsUser(request);
  const created = await request.post("/api/lists", {
    headers: a.headers,
    data: { groupId: a.groupId, title: "買い物" },
  });
  const list = await created.json();
  const carrot = await (
    await request.post(`/api/lists/${list.id}/items`, { headers: a.headers, data: { text: "にんじん" } })
  ).json();
  await request.post(`/api/lists/${list.id}/items`, { headers: a.headers, data: { text: "たまねぎ" } });

  const before = await (await request.get("/api/lists", { headers: a.headers })).json();
  expect(before.lists[0].itemCount).toBe(2);
  expect(before.lists[0].remainingCount).toBe(2);

  await request.patch(`/api/lists/${list.id}/items/${carrot.id}`, { headers: a.headers, data: { checked: true } });

  const after = await (await request.get("/api/lists", { headers: a.headers })).json();
  expect(after.lists[0].itemCount).toBe(2);
  expect(after.lists[0].remainingCount).toBe(1);
});

test("日付を付けたリストは、その日の探す(0046)に出る", async ({ request }) => {
  const a = await listsUser(request);
  await request.post("/api/lists", {
    headers: a.headers,
    data: { groupId: a.groupId, title: "旅行の持ち物", date: "2026-09-25" },
  });

  const found = await (await request.get("/api/search?q=旅行", { headers: a.headers })).json();
  expect(found.items).toHaveLength(1);
  expect(found.items[0].title).toBe("旅行の持ち物");
  expect(found.items[0].extension).toBe("lists");
  expect(found.items[0].kind).toBe("record");

  const none = await (await request.get("/api/search?q=見つからない", { headers: a.headers })).json();
  expect(none.items).toHaveLength(0);
});
