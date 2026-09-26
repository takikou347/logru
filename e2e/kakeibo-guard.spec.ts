import { type APIRequestContext, expect, test } from "@playwright/test";
import { apiUser, tokyoDateParts } from "./helpers";

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

/** その人の利用者 ID を読む */
async function userId(request: APIRequestContext, user: { headers: Record<string, string> }): Promise<string> {
  const me = await (await request.get("/api/me", { headers: user.headers })).json();
  return me.user.id;
}

/** その人の自分だけのグループに、口座を 1 つ作る */
async function createAccount(
  request: APIRequestContext,
  user: { headers: Record<string, string>; groupId: string },
  name = "現金",
  opts: { kind?: string; openingBalance?: number; groupId?: string } = {},
) {
  const res = await request.post("/api/kakeibo/accounts", {
    headers: user.headers,
    data: {
      groupId: opts.groupId ?? user.groupId,
      name,
      kind: opts.kind ?? "cash",
      openingBalance: opts.openingBalance ?? 0,
    },
  });
  expect(res.status()).toBe(201);
  return res.json();
}

test("ほかの人の記録には届かない。グループの外からは作れない", async ({ request }) => {
  const a = await kakeiboUser(request);
  const b = await kakeiboUser(request);
  const created = await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { type: "expense", groupId: a.groupId, date: "2026-09-19", amount: 1200, category: "food" },
  });
  expect(created.status()).toBe(201);
  const expense = await created.json();

  // 別の人が同じグループの月の合計を読もうとしても、メンバーでなければ見えない
  const denied = await request.get(`/api/kakeibo?group=${a.groupId}&month=2026-09`, { headers: b.headers });
  expect(denied.status()).toBe(404);

  // グループを指定しなければ、自分の使えるグループだけの合計になる。ほかの人の記録は混ざらない
  const bAll = await (await request.get("/api/kakeibo?month=2026-09", { headers: b.headers })).json();
  expect(bAll.totalExpense).toBe(0);
  expect(bAll.records).toHaveLength(0);

  // ほかの人のグループには記録を作れない
  const deniedCreate = await request.post("/api/kakeibo", {
    headers: b.headers,
    data: { type: "expense", groupId: a.groupId, date: "2026-09-19", amount: 500, category: "food" },
  });
  expect(deniedCreate.status()).toBe(404);

  // グループの外からは、直すことも消すこともできない。見えないのと同じ 404
  const deniedPatch = await request.patch(`/api/kakeibo/${expense.id}`, {
    headers: b.headers,
    data: { type: "expense", groupId: a.groupId, date: "2026-09-19", amount: 1, category: "food" },
  });
  expect(deniedPatch.status()).toBe(404);
  const deniedDelete = await request.delete(`/api/kakeibo/${expense.id}`, { headers: b.headers });
  expect(deniedDelete.status()).toBe(404);
});

test("共有のグループの記録は、書いた人でなくてもメンバーなら直せる、消せる。issue #206、0079", async ({ request }) => {
  const owner = await kakeiboUser(request);
  const member = await kakeiboUser(request);
  const group = await (await request.post("/api/groups", { headers: owner.headers, data: { name: "ふたり" } })).json();
  await request.put(`/api/groups/${group.id}/extensions/kakeibo`, { headers: owner.headers, data: { enabled: true } });
  const { token } = await (await request.post(`/api/groups/${group.id}/invites`, { headers: owner.headers })).json();
  expect((await request.post(`/api/invites/${token}/accept`, { headers: member.headers })).ok()).toBe(true);

  const created = await request.post("/api/kakeibo", {
    headers: owner.headers,
    data: { type: "expense", groupId: group.id, date: "2026-09-19", amount: 1000, category: "food" },
  });
  const expense = await created.json();

  // メンバーなので、合計と一覧には出る
  const summary = await (
    await request.get(`/api/kakeibo?group=${group.id}&month=2026-09`, { headers: member.headers })
  ).json();
  expect(summary.totalExpense).toBe(1000);
  expect(summary.records).toHaveLength(1);

  // 書いた人でなくても、共有のグループのメンバーなら直せる
  const patched = await request.patch(`/api/kakeibo/${expense.id}`, {
    headers: member.headers,
    data: { type: "expense", groupId: group.id, date: "2026-09-19", amount: 1500, category: "food" },
  });
  expect(patched.status()).toBe(200);
  expect((await patched.json()).amount).toBe(1500);
  // 消せる
  const deleted = await request.delete(`/api/kakeibo/${expense.id}`, { headers: member.headers });
  expect(deleted.status()).toBe(204);
});

test("自分だけの記録は、同じグループの人でも直せない、消せない。issue #206、0079", async ({ request }) => {
  const owner = await kakeiboUser(request);
  const member = await kakeiboUser(request);
  const group = await (await request.post("/api/groups", { headers: owner.headers, data: { name: "ふたり" } })).json();
  await request.put(`/api/groups/${group.id}/extensions/kakeibo`, { headers: owner.headers, data: { enabled: true } });
  const { token } = await (await request.post(`/api/groups/${group.id}/invites`, { headers: owner.headers })).json();
  expect((await request.post(`/api/invites/${token}/accept`, { headers: member.headers })).ok()).toBe(true);

  // owner の自分だけのグループ(personal)に記録する。member とは「ふたり」を共有していても、
  // 自分だけのグループ自体は共有していない
  const created = await request.post("/api/kakeibo", {
    headers: owner.headers,
    data: { type: "expense", groupId: owner.groupId, date: "2026-09-19", amount: 1000, category: "food" },
  });
  const expense = await created.json();

  const patched = await request.patch(`/api/kakeibo/${expense.id}`, {
    headers: member.headers,
    data: { type: "expense", groupId: owner.groupId, date: "2026-09-19", amount: 1, category: "food" },
  });
  expect(patched.status()).toBe(404);
  const deleted = await request.delete(`/api/kakeibo/${expense.id}`, { headers: member.headers });
  expect(deleted.status()).toBe(404);
});

test("共有のグループの精算した記録は、書いた人でなくてもメンバーなら消せる。グループの外からは消せない。issue #206、0079", async ({
  request,
}) => {
  const owner = await kakeiboUser(request);
  const member = await kakeiboUser(request);
  const outsider = await kakeiboUser(request);
  const group = await (await request.post("/api/groups", { headers: owner.headers, data: { name: "ふたり" } })).json();
  await request.put(`/api/groups/${group.id}/extensions/kakeibo`, { headers: owner.headers, data: { enabled: true } });
  const { token } = await (await request.post(`/api/groups/${group.id}/invites`, { headers: owner.headers })).json();
  await request.post(`/api/invites/${token}/accept`, { headers: member.headers });

  const ownerId = await userId(request, owner);
  const memberId = await userId(request, member);
  const created = await request.post("/api/kakeibo/settlements", {
    headers: owner.headers,
    data: { groupId: group.id, fromUser: memberId, toUser: ownerId, amount: 1000, date: "2026-09-19" },
  });
  expect(created.status()).toBe(201);
  const settlement = await created.json();

  // グループの外からは 404
  const deniedDelete = await request.delete(`/api/kakeibo/settlements/${settlement.id}`, {
    headers: outsider.headers,
  });
  expect(deniedDelete.status()).toBe(404);

  // 書いた人(owner)でなくても、メンバー(member)なら消せる
  const deleted = await request.delete(`/api/kakeibo/settlements/${settlement.id}`, { headers: member.headers });
  expect(deleted.status()).toBe(204);
});

test("記録すると月の合計とカテゴリ別の合計に反映される。振替は数えない。F-301、F-303、F-310、F-311", async ({
  request,
}) => {
  const a = await kakeiboUser(request);
  const cash = await createAccount(request, a, "現金");
  const bank = await createAccount(request, a, "銀行", { kind: "bank" });
  await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { type: "expense", groupId: a.groupId, date: "2026-09-05", amount: 1200, category: "food", memo: "スーパー" },
  });
  await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { type: "expense", groupId: a.groupId, date: "2026-09-19", amount: 800, category: "transport" },
  });
  await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { type: "income", groupId: a.groupId, date: "2026-09-10", amount: 3000, category: "salary" },
  });
  await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { type: "transfer", date: "2026-09-12", amount: 500, accountId: bank.id, toAccountId: cash.id },
  });
  // 別の月の記録は、この月の合計に混ざらない
  await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { type: "expense", groupId: a.groupId, date: "2026-10-01", amount: 5000, category: "hobby" },
  });

  const summary = await (
    await request.get(`/api/kakeibo?group=${a.groupId}&month=2026-09`, { headers: a.headers })
  ).json();
  expect(summary.totalExpense).toBe(2000);
  expect(summary.totalIncome).toBe(3000);
  expect(summary.records).toHaveLength(4);
  // 記録のあるカテゴリだけを、多い順で返す
  expect(summary.byCategory).toEqual([
    { category: "food", total: 1200 },
    { category: "transport", total: 800 },
  ]);
});

test("書いた人は直せて消せる。金額とカテゴリの誤りは断る。0069", async ({ request }) => {
  const a = await kakeiboUser(request);
  const created = await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { type: "expense", groupId: a.groupId, date: "2026-09-19", amount: 1000, category: "food" },
  });
  const expense = await created.json();

  const bad = await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { type: "expense", groupId: a.groupId, date: "2026-09-19", amount: 0, category: "food" },
  });
  expect(bad.status()).toBe(400);
  const tooMuch = await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { type: "expense", groupId: a.groupId, date: "2026-09-19", amount: 100_000_001, category: "food" },
  });
  expect(tooMuch.status()).toBe(400);
  const badCategory = await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { type: "expense", groupId: a.groupId, date: "2026-09-19", amount: 100, category: "rent" },
  });
  expect(badCategory.status()).toBe(400);
  // 収入のカテゴリを支出として送っても断る
  const wrongType = await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { type: "expense", groupId: a.groupId, date: "2026-09-19", amount: 100, category: "salary" },
  });
  expect(wrongType.status()).toBe(400);

  const patched = await request.patch(`/api/kakeibo/${expense.id}`, {
    headers: a.headers,
    data: { type: "expense", groupId: a.groupId, date: "2026-09-19", amount: 1500, category: "dining_out" },
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

test("振替は出す元と入れる先が同じなら断り、金額は数えない", async ({ request }) => {
  const a = await kakeiboUser(request);
  const cash = await createAccount(request, a, "現金");
  const same = await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { type: "transfer", date: "2026-09-19", amount: 500, accountId: cash.id, toAccountId: cash.id },
  });
  expect(same.status()).toBe(400);
});

test("拡張を無効にしたグループは、読めなくなるがデータは消えない。F-308", async ({ request }) => {
  const a = await kakeiboUser(request);
  await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { type: "expense", groupId: a.groupId, date: "2026-09-19", amount: 700, category: "food" },
  });
  await request.put(`/api/groups/${a.groupId}/extensions/kakeibo`, { headers: a.headers, data: { enabled: false } });
  const off = await (await request.get("/api/kakeibo?month=2026-09", { headers: a.headers })).json();
  expect(off.records).toHaveLength(0);

  await request.put(`/api/groups/${a.groupId}/extensions/kakeibo`, { headers: a.headers, data: { enabled: true } });
  const on = await (await request.get(`/api/kakeibo?group=${a.groupId}&month=2026-09`, { headers: a.headers })).json();
  expect(on.records).toHaveLength(1);
  expect(on.totalExpense).toBe(700);
});

test("自分で使わないと決めると、グループで有効でも家計簿の API は使えない。0019", async ({ request }) => {
  const a = await kakeiboUser(request);
  await request.put(`/api/groups/${a.groupId}/extensions/kakeibo`, { headers: a.headers, data: { enabled: false } });
  const res = await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { type: "expense", groupId: a.groupId, date: "2026-09-19", amount: 100, category: "food" },
  });
  expect(res.status()).toBe(404);
});

test("メモを探すと、見つかった日の支出の合計が土台の探す(0046)に出る。振替と収入は探さない", async ({ request }) => {
  const a = await kakeiboUser(request);
  await request.post("/api/kakeibo", {
    headers: a.headers,
    data: {
      type: "expense",
      groupId: a.groupId,
      date: "2026-09-05",
      amount: 1200,
      category: "food",
      memo: "湯本のスーパー",
    },
  });
  await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { type: "expense", groupId: a.groupId, date: "2026-09-05", amount: 300, category: "hobby" },
  });
  await request.post("/api/kakeibo", {
    headers: a.headers,
    data: { type: "expense", groupId: a.groupId, date: "2026-09-19", amount: 500, category: "transport", memo: "電車" },
  });
  await request.post("/api/kakeibo", {
    headers: a.headers,
    data: {
      type: "income",
      groupId: a.groupId,
      date: "2026-09-05",
      amount: 3000,
      category: "salary",
      memo: "湯本の給料",
    },
  });

  const found = await (await request.get("/api/search?q=スーパー", { headers: a.headers })).json();
  expect(found.items).toHaveLength(1);
  // その日の支出だけの合計を返す。メモの無い記録も含む。収入は数えない
  expect(found.items[0].title).toBe("¥1,500");
  expect(found.items[0].extension).toBe("kakeibo");

  const none = await (await request.get("/api/search?q=見つからない", { headers: a.headers })).json();
  expect(none.items).toHaveLength(0);
  // 収入のメモは探さない
  const income = await (await request.get("/api/search?q=給料", { headers: a.headers })).json();
  expect(income.items).toHaveLength(0);
});

test("口座はそのグループのメンバーしか使えない。使う人以外には 404", async ({ request }) => {
  const a = await kakeiboUser(request);
  const b = await kakeiboUser(request);
  const account = await createAccount(request, a, "現金");

  const getDenied = await request.get(`/api/kakeibo/accounts?group=${a.groupId}`, { headers: b.headers });
  expect(getDenied.status()).toBe(404);
  const patchDenied = await request.patch(`/api/kakeibo/accounts/${account.id}`, {
    headers: b.headers,
    data: { name: "乗っ取り" },
  });
  expect(patchDenied.status()).toBe(404);
  const deleteDenied = await request.delete(`/api/kakeibo/accounts/${account.id}`, { headers: b.headers });
  expect(deleteDenied.status()).toBe(404);
  const recordsDenied = await request.get(`/api/kakeibo/accounts/${account.id}/records?month=2026-09`, {
    headers: b.headers,
  });
  expect(recordsDenied.status()).toBe(404);
});

test("他人の自分の口座は、支出・収入・振替のどれにも使えない", async ({ request }) => {
  const a = await kakeiboUser(request);
  const b = await kakeiboUser(request);
  const aCash = await createAccount(request, a, "現金");
  const bCash = await createAccount(request, b, "現金");

  const expenseDenied = await request.post("/api/kakeibo", {
    headers: b.headers,
    data: {
      type: "expense",
      groupId: b.groupId,
      date: "2026-09-19",
      amount: 100,
      category: "food",
      accountId: aCash.id,
    },
  });
  expect(expenseDenied.status()).toBe(404);

  const transferDenied = await request.post("/api/kakeibo", {
    headers: b.headers,
    data: { type: "transfer", date: "2026-09-19", amount: 100, accountId: bCash.id, toAccountId: aCash.id },
  });
  expect(transferDenied.status()).toBe(404);
});

test("記録のある口座は消せない。使わないにはできる。F-309", async ({ request }) => {
  const a = await kakeiboUser(request);
  const account = await createAccount(request, a, "現金");
  await request.post("/api/kakeibo", {
    headers: a.headers,
    data: {
      type: "expense",
      groupId: a.groupId,
      date: "2026-09-19",
      amount: 100,
      category: "food",
      accountId: account.id,
    },
  });

  const deleteDenied = await request.delete(`/api/kakeibo/accounts/${account.id}`, { headers: a.headers });
  expect(deleteDenied.status()).toBe(409);

  const archived = await request.patch(`/api/kakeibo/accounts/${account.id}`, {
    headers: a.headers,
    data: { archived: true },
  });
  expect(archived.status()).toBe(200);
  expect((await archived.json()).archivedAt).not.toBeNull();

  // 使わない口座は、新しい記録では選べない
  const denied = await request.post("/api/kakeibo", {
    headers: a.headers,
    data: {
      type: "expense",
      groupId: a.groupId,
      date: "2026-09-20",
      amount: 100,
      category: "food",
      accountId: account.id,
    },
  });
  expect(denied.status()).toBe(400);
});

test("共有口座への振替は、共有のグループの人には金額と入った先だけが見え、出した元は「〇〇さんの口座」になる。F-313", async ({
  request,
}) => {
  const owner = await kakeiboUser(request);
  const member = await kakeiboUser(request);
  const group = await (await request.post("/api/groups", { headers: owner.headers, data: { name: "ふたり" } })).json();
  await request.put(`/api/groups/${group.id}/extensions/kakeibo`, { headers: owner.headers, data: { enabled: true } });
  const { token } = await (await request.post(`/api/groups/${group.id}/invites`, { headers: owner.headers })).json();
  await request.post(`/api/invites/${token}/accept`, { headers: member.headers });

  const ownerCash = await createAccount(request, owner, "現金");
  const shared = await createAccount(request, owner, "共有の財布", { kind: "bank", groupId: group.id });

  const transfer = await request.post("/api/kakeibo", {
    headers: owner.headers,
    data: { type: "transfer", date: "2026-09-19", amount: 5000, accountId: ownerCash.id, toAccountId: shared.id },
  });
  expect(transfer.status()).toBe(201);

  const summary = await (
    await request.get(`/api/kakeibo?group=${group.id}&month=2026-09`, { headers: member.headers })
  ).json();
  expect(summary.records).toHaveLength(1);
  const record = summary.records[0];
  expect(record.amount).toBe(5000);
  expect(record.toAccount).toEqual({ id: shared.id, name: "共有の財布", kind: "bank" });
  expect(record.account.id).toBe(ownerCash.id);
  expect(record.account.hidden).toBe(true);
  // 表示名を登録していない API 利用者は、メールアドレスの @ より前が名前になる
  expect(record.account.ownerName).toBe(owner.email.split("@")[0]);

  // 共有口座は、そのグループのメンバーには一覧に出る。自分だけの口座は出ない
  const accounts = await (
    await request.get(`/api/kakeibo/accounts?group=${group.id}`, { headers: member.headers })
  ).json();
  expect(accounts.accounts.map((x: { id: string }) => x.id)).toEqual([shared.id]);
});

test("月に 501 件書いても、合計は一覧を切る前の全件から出る。一覧は 500 件で切り、切ったと知らせる。#199", async ({
  request,
}) => {
  test.setTimeout(120_000);
  const a = await kakeiboUser(request);
  const month = tokyoDateParts().key.slice(0, 7);
  const date = tokyoDateParts().key;

  // 501 件を一度に作る。並べて作ると速いので、一定数ずつまとめて投げる
  const total = 501;
  const concurrency = 25;
  for (let i = 0; i < total; i += concurrency) {
    const batch = Array.from({ length: Math.min(concurrency, total - i) }, () =>
      request.post("/api/kakeibo", {
        headers: a.headers,
        data: { type: "expense", groupId: a.groupId, date, amount: 10, category: "food" },
      }),
    );
    const results = await Promise.all(batch);
    for (const r of results) expect(r.status()).toBe(201);
  }

  const summary = await (
    await request.get(`/api/kakeibo?group=${a.groupId}&month=${month}`, { headers: a.headers })
  ).json();
  // 一覧は 500 件で切るが、合計は 501 件全部から出る。割った記録が多いときの分け方はユニットテストで確かめる。#199
  expect(summary.records).toHaveLength(500);
  expect(summary.totalExpense).toBe(total * 10);
  expect(summary.byCategory).toEqual([{ category: "food", total: total * 10 }]);
  expect(summary.recordsTruncated).toBe(true);
});
