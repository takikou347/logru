import { expect, test } from "@playwright/test";
import { apiUser } from "./helpers";

/** API は Firebase の ID トークンで守る。ログインは Firebase、データは D1。0004 */

test("トークンが無ければ 401", async ({ request }) => {
  const res = await request.get("/api/me");
  expect(res.status()).toBe(401);
});

test("でたらめなトークンは 401", async ({ request }) => {
  const res = await request.get("/api/me", { headers: { Authorization: "Bearer not-a-token" } });
  expect(res.status()).toBe(401);
});

test("メールアドレスを確かめていなければ 403", async ({ request }) => {
  const { headers } = await apiUser(request, { verified: false });
  const res = await request.get("/api/me", { headers });
  expect(res.status()).toBe(403);
  expect((await res.json()).code).toBe("EMAIL_NOT_VERIFIED");
});

test("規約に同意するまで、書き込みは断る", async ({ request }) => {
  const { headers } = await apiUser(request);
  const me = await request.get("/api/me", { headers });
  expect(me.status()).toBe(200);
  expect((await me.json()).needsAgreement.length).toBeGreaterThan(0);

  const denied = await request.post("/api/groups", { headers, data: { name: "x" } });
  expect(denied.status()).toBe(403);
  expect((await denied.json()).code).toBe("LEGAL_NOT_AGREED");

  await request.post("/api/me/agreements", { headers, data: { agreed: true } });
  const allowed = await request.post("/api/groups", { headers, data: { name: "x" } });
  expect(allowed.status()).toBe(201);
});

test("初めての要求が同時に来ても、自分だけのグループは 1 つ", async ({ request }) => {
  const { headers } = await apiUser(request);
  await Promise.all([1, 2, 3, 4].map(() => request.get("/api/me", { headers })));
  await request.post("/api/me/agreements", { headers, data: { agreed: true } });
  const res = await request.get("/api/groups", { headers });
  const { groups } = (await res.json()) as { groups: { isPersonal: boolean }[] };
  expect(groups.filter((g) => g.isPersonal)).toHaveLength(1);
});
