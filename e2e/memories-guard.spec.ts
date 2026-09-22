import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type APIRequestContext, expect, test } from "@playwright/test";
import { apiUser } from "./helpers";

const PHOTO = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/photo.jpg"));
const TINY = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";

/** 規約に同意し、自分だけのグループで思い出を使えるようにした利用者 */
async function memoriesUser(request: APIRequestContext) {
  const user = await apiUser(request);
  await request.post("/api/me/agreements", { headers: user.headers, data: { agreed: true } });
  const { personalGroupId } = await (await request.get("/api/extensions", { headers: user.headers })).json();
  const on = await request.put(`/api/groups/${personalGroupId}/extensions/memories`, { headers: user.headers, data: { enabled: true } });
  expect(on.status()).toBe(200);
  return { ...user, groupId: personalGroupId as string };
}

/** 写真を 1 枚送る */
async function upload(request: APIRequestContext, headers: Record<string, string>, groupId: string, body = PHOTO) {
  return request.post("/api/memories/photos", {
    headers,
    multipart: {
      groupId,
      width: "640",
      height: "427",
      tiny: TINY,
      full: { name: "full.jpg", mimeType: "image/jpeg", buffer: body },
      thumb: { name: "thumb.jpg", mimeType: "image/jpeg", buffer: body },
    },
  });
}

test("ほかの人の思い出と記録には届かない。F-124", async ({ request }) => {
  const a = await memoriesUser(request);
  const b = await memoriesUser(request);
  const memory = await (
    await request.post("/api/memories", {
      headers: a.headers,
      data: { groupId: a.groupId, title: "ひとり旅", firstDay: "2026-09-19", lastDay: "2026-09-19", timeZone: "Asia/Tokyo" },
    })
  ).json();
  expect((await request.get(`/api/memories/${memory.id}`, { headers: b.headers })).status()).toBe(404);
  // ほかの人のグループには、思い出も写真も置けない
  const denied = await request.post("/api/memories", {
    headers: b.headers,
    data: { groupId: a.groupId, title: "x", firstDay: "2026-09-19", lastDay: "2026-09-19", timeZone: "Asia/Tokyo" },
  });
  expect(denied.status()).toBe(404);
  expect((await upload(request, b.headers, a.groupId)).status()).toBe(404);
});

test("写真の URL は署名が合うときだけ返し、JPEG でないものは受け付けない。0021", async ({ request }) => {
  const a = await memoriesUser(request);
  const res = await upload(request, a.headers, a.groupId);
  expect(res.status()).toBe(201);
  const photo = await res.json();

  const ok = await request.get(photo.thumbUrl);
  expect(ok.status()).toBe(200);
  expect(ok.headers()["content-type"]).toBe("image/jpeg");

  const tampered = photo.thumbUrl.replace(/s=[^&]+/, "s=AAAA");
  expect((await request.get(tampered)).status()).toBe(403);
  // 別の大きさに付け替えても通らない
  expect((await request.get(photo.thumbUrl.replace("/thumb?", "/full?"))).status()).toBe(403);

  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect((await upload(request, a.headers, a.groupId, png)).status()).toBe(400);
});

test("思い出の拡張を無効にしたグループは、読めなくなるがデータは消えない。F-125", async ({ request }) => {
  const a = await memoriesUser(request);
  const rec = await request.post("/api/memories/records", { headers: a.headers, data: { groupId: a.groupId, body: "メモ" } });
  expect(rec.status()).toBe(201);
  await request.put(`/api/groups/${a.groupId}/extensions/memories`, { headers: a.headers, data: { enabled: false } });
  const list = await (await request.get("/api/memories", { headers: a.headers })).json();
  expect(list.recent).toHaveLength(0);
  await request.put(`/api/groups/${a.groupId}/extensions/memories`, { headers: a.headers, data: { enabled: true } });
  const again = await (await request.get("/api/memories", { headers: a.headers })).json();
  expect(again.recent.map((r: { body: string }) => r.body)).toEqual(["メモ"]);
});
