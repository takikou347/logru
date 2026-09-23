import { type APIRequestContext, expect, test } from "@playwright/test";
import { apiUser } from "./helpers";

/** 規約に同意し、自分だけのグループで家計簿を使えるようにした利用者 */
async function kakeiboUser(request: APIRequestContext) {
  const user = await apiUser(request);
  await request.post("/api/me/agreements", { headers: user.headers, data: { agreed: true } });
  const { personalGroupId } = await (await request.get("/api/extensions", { headers: user.headers })).json();
  const on = await request.put(`/api/groups/${personalGroupId}/extensions/kakeibo`, {
    headers: user.headers,
    data: { enabled: true },
  });
  expect(on.status()).toBe(200);
  return { ...user, groupId: personalGroupId as string };
}

test("ほかの人の記録には届かない。グループの外からは作れない", async ({ request }) => {
  const a = await kakeiboUser(request);
  const b = await kakeiboUser(request);
  const created = await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { groupId: a.groupId, date: "2026-09-19", amount: 1200, category: "food" },
  });
  expect(created.status()).toBe(201);
  const expense = await created.json();

  // 別の人が同じグループの月の合計を読もうとしても、メンバーでなければ見えない
  const denied = await request.get(`/api/kakeibo?group=${a.groupId}&month=2026-09`, { headers: b.headers });
  expect(denied.status()).toBe(404);

  // グループを指定しなければ、自分の使えるグループだけの合計になる。ほかの人の記録は混ざらない
  const bAll = await (await request.get("/api/kakeibo?month=2026-09", { headers: b.headers })).json();
  expect(bAll.total).toBe(0);
  expect(bAll.records).toHaveLength(0);

  // ほかの人のグループには記録を作れない
  const deniedCreate = await request.post("/api/kakeibo", {
    headers: b.headers,
    data: { groupId: a.groupId, date: "2026-09-19", amount: 500, category: "food" },
  });
  expect(deniedCreate.status()).toBe(404);

  // グループの外からは、直すことも消すこともできない。見えないのと同じ 404
  const deniedPatch = await request.patch(`/api/kakeibo/${expense.id}`, { headers: b.headers, data: { amount: 1 } });
  expect(deniedPatch.status()).toBe(404);
  const deniedDelete = await request.delete(`/api/kakeibo/${expense.id}`, { headers: b.headers });
  expect(deniedDelete.status()).toBe(404);
});

test("同じグループのメンバーでも、書いた人以外は直せない、消せない", async ({ request }) => {
  const owner = await kakeiboUser(request);
  const member = await kakeiboUser(request);
  const group = await (await request.post("/api/groups", { headers: owner.headers, data: { name: "ふたり" } })).json();
  await request.put(`/api/groups/${group.id}/extensions/kakeibo`, { headers: owner.headers, data: { enabled: true } });
  const { token } = await (await request.post(`/api/groups/${group.id}/invites`, { headers: owner.headers })).json();
  expect((await request.post(`/api/invites/${token}/accept`, { headers: member.headers })).ok()).toBe(true);

  const created = await request.post("/api/kakeibo", {
    headers: owner.headers,
    data: { groupId: group.id, date: "2026-09-19", amount: 1000, category: "food" },
  });
  const expense = await created.json();

  // メンバーなので、合計と一覧には出る
  const summary = await (
    await request.get(`/api/kakeibo?group=${group.id}&month=2026-09`, { headers: member.headers })
  ).json();
  expect(summary.total).toBe(1000);
  expect(summary.records).toHaveLength(1);

  // 書いた人ではないので、直せないし消せない
  const patched = await request.patch(`/api/kakeibo/${expense.id}`, { headers: member.headers, data: { amount: 1 } });
  expect(patched.status()).toBe(403);
  const deleted = await request.delete(`/api/kakeibo/${expense.id}`, { headers: member.headers });
  expect(deleted.status()).toBe(403);
});

test("記録すると月の合計とカテゴリ別の合計に反映される。F-301、F-303", async ({ request }) => {
  const a = await kakeiboUser(request);
  await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { groupId: a.groupId, date: "2026-09-05", amount: 1200, category: "food", memo: "スーパー" },
  });
  await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { groupId: a.groupId, date: "2026-09-19", amount: 800, category: "transport" },
  });
  // 別の月の記録は、この月の合計に混ざらない
  await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { groupId: a.groupId, date: "2026-10-01", amount: 5000, category: "hobby" },
  });

  const summary = await (
    await request.get(`/api/kakeibo?group=${a.groupId}&month=2026-09`, { headers: a.headers })
  ).json();
  expect(summary.total).toBe(2000);
  expect(summary.records).toHaveLength(2);
  expect(summary.byCategory.find((c: { category: string }) => c.category === "food").total).toBe(1200);
  expect(summary.byCategory.find((c: { category: string }) => c.category === "transport").total).toBe(800);
  expect(summary.byCategory.find((c: { category: string }) => c.category === "hobby").total).toBe(0);
  expect(summary.byCategory).toHaveLength(6);
});

test("書いた人は直せて消せる。金額とカテゴリの誤りは断る", async ({ request }) => {
  const a = await kakeiboUser(request);
  const created = await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { groupId: a.groupId, date: "2026-09-19", amount: 1000, category: "food" },
  });
  const expense = await created.json();

  const bad = await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { groupId: a.groupId, date: "2026-09-19", amount: 0, category: "food" },
  });
  expect(bad.status()).toBe(400);
  const badCategory = await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { groupId: a.groupId, date: "2026-09-19", amount: 100, category: "rent" },
  });
  expect(badCategory.status()).toBe(400);

  const patched = await request.patch(`/api/kakeibo/${expense.id}`, {
    headers: a.headers,
    data: { amount: 1500, category: "dining_out" },
  });
  expect(patched.status()).toBe(200);
  expect((await patched.json()).amount).toBe(1500);

  const deleted = await request.delete(`/api/kakeibo/${expense.id}`, { headers: a.headers });
  expect(deleted.status()).toBe(204);
  const after = await (
    await request.get(`/api/kakeibo?group=${a.groupId}&month=2026-09`, { headers: a.headers })
  ).json();
  expect(after.records).toHaveLength(0);
});

test("拡張を無効にしたグループは、読めなくなるがデータは消えない。F-308", async ({ request }) => {
  const a = await kakeiboUser(request);
  await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { groupId: a.groupId, date: "2026-09-19", amount: 700, category: "food" },
  });
  await request.put(`/api/groups/${a.groupId}/extensions/kakeibo`, { headers: a.headers, data: { enabled: false } });
  const off = await (await request.get("/api/kakeibo?month=2026-09", { headers: a.headers })).json();
  expect(off.records).toHaveLength(0);

  await request.put(`/api/groups/${a.groupId}/extensions/kakeibo`, { headers: a.headers, data: { enabled: true } });
  const on = await (await request.get(`/api/kakeibo?group=${a.groupId}&month=2026-09`, { headers: a.headers })).json();
  expect(on.records).toHaveLength(1);
  expect(on.total).toBe(700);
});

test("自分で使わないと決めると、グループで有効でも家計簿の API は使えない。0019", async ({ request }) => {
  const a = await kakeiboUser(request);
  await request.put(`/api/groups/${a.groupId}/extensions/kakeibo`, { headers: a.headers, data: { enabled: false } });
  const res = await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { groupId: a.groupId, date: "2026-09-19", amount: 100, category: "food" },
  });
  expect(res.status()).toBe(404);
});

test("メモを探すと、見つかった日の合計が土台の探す(0046)に出る", async ({ request }) => {
  const a = await kakeiboUser(request);
  await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { groupId: a.groupId, date: "2026-09-05", amount: 1200, category: "food", memo: "湯本のスーパー" },
  });
  await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { groupId: a.groupId, date: "2026-09-05", amount: 300, category: "hobby" },
  });
  await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { groupId: a.groupId, date: "2026-09-19", amount: 500, category: "transport", memo: "電車" },
  });

  const found = await (await request.get("/api/search?q=スーパー", { headers: a.headers })).json();
  expect(found.items).toHaveLength(1);
  // その日の記録すべての合計を返す。メモの無い記録も含む
  expect(found.items[0].title).toBe("¥1,500");
  expect(found.items[0].extension).toBe("kakeibo");

  const none = await (await request.get("/api/search?q=見つからない", { headers: a.headers })).json();
  expect(none.items).toHaveLength(0);
});
