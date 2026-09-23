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
  const on = await request.put(`/api/groups/${personalGroupId}/extensions/memories`, {
    headers: user.headers,
    data: { enabled: true },
  });
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
      data: {
        groupId: a.groupId,
        title: "ひとり旅",
        firstDay: "2026-09-19",
        lastDay: "2026-09-19",
        timeZone: "Asia/Tokyo",
      },
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
  const rec = await request.post("/api/memories/records", {
    headers: a.headers,
    data: { groupId: a.groupId, body: "メモ" },
  });
  expect(rec.status()).toBe(201);
  await request.put(`/api/groups/${a.groupId}/extensions/memories`, { headers: a.headers, data: { enabled: false } });
  const list = await (await request.get("/api/memories", { headers: a.headers })).json();
  expect(list.recent).toHaveLength(0);
  await request.put(`/api/groups/${a.groupId}/extensions/memories`, { headers: a.headers, data: { enabled: true } });
  const again = await (await request.get("/api/memories", { headers: a.headers })).json();
  expect(again.recent.map((r: { body: string }) => r.body)).toEqual(["メモ"]);
});

test("端末の送り先は本人だけが置けて外せる。https だけを受け付ける。F-23", async ({ request }) => {
  const a = await memoriesUser(request);
  const b = await memoriesUser(request);
  const info = await (await request.get("/api/me/push", { headers: a.headers })).json();
  expect(info.publicKey).toBeTruthy();
  const keys = {
    p256dh: "BPUm_oLClft9DRthvDIJ303Z0PABoblpADTHcpnZtA0zpfzPQQvBFAfi6afKxM4dsTjIbTqkEH9MCj3xFw6hBOs",
    auth: "c2VjcmV0c2VjcmV0MTIzNA",
  };
  const http = await request.post("/api/me/push", {
    headers: a.headers,
    data: { endpoint: "http://fcm.googleapis.com/fcm/send/x", keys },
  });
  expect(http.status()).toBe(400);
  // 知られたブラウザーの送り先のホストだけを受け付ける
  const unknownHost = await request.post("/api/me/push", {
    headers: a.headers,
    data: { endpoint: "https://push.example/x", keys },
  });
  expect(unknownHost.status()).toBe(400);
  const ok = await request.post("/api/me/push", {
    headers: a.headers,
    data: { endpoint: `https://fcm.googleapis.com/fcm/send/${Date.now()}`, keys },
  });
  expect(ok.status()).toBe(201);
  const { id } = await ok.json();
  // ほかの人は外せない
  await request.delete(`/api/me/push/${id}`, { headers: b.headers });
  expect((await (await request.get("/api/me/push", { headers: a.headers })).json()).devices).toHaveLength(1);
  await request.delete(`/api/me/push/${id}`, { headers: a.headers });
  expect((await (await request.get("/api/me/push", { headers: a.headers })).json()).devices).toHaveLength(0);
});

test("同じ送り先をほかの人が登録すると、行は消えて作り直り、持ち主が変わる。0065、#161", async ({ request }) => {
  const a = await memoriesUser(request);
  const b = await memoriesUser(request);
  const keys = {
    p256dh: "BPUm_oLClft9DRthvDIJ303Z0PABoblpADTHcpnZtA0zpfzPQQvBFAfi6afKxM4dsTjIbTqkEH9MCj3xFw6hBOs",
    auth: "c2VjcmV0c2VjcmV0MTIzNA",
  };
  const endpoint = `https://fcm.googleapis.com/fcm/send/${Date.now()}`;
  await request.post("/api/me/push", { headers: a.headers, data: { endpoint, keys } });
  expect((await (await request.get("/api/me/push", { headers: a.headers })).json()).devices).toHaveLength(1);
  await request.post("/api/me/push", { headers: b.headers, data: { endpoint, keys } });
  // 元の持ち主からは消え、新しく登録した人だけが持つ
  expect((await (await request.get("/api/me/push", { headers: a.headers })).json()).devices).toHaveLength(0);
  expect((await (await request.get("/api/me/push", { headers: b.headers })).json()).devices).toHaveLength(1);
});

test("未来の時刻の記録は断る", async ({ request }) => {
  const a = await memoriesUser(request);
  const future = await request.post("/api/memories/records", {
    headers: a.headers,
    data: { groupId: a.groupId, body: "まだ", occurredAt: Date.now() + 3 * 60 * 60 * 1000 },
  });
  expect(future.status()).toBe(400);
});

test("自分で使わないと決めると、グループで有効でも思い出の API は使えない。0019", async ({ request }) => {
  const a = await memoriesUser(request);
  await request.put(`/api/groups/${a.groupId}/extensions/memories`, { headers: a.headers, data: { enabled: false } });
  const res = await request.post("/api/memories/records", {
    headers: a.headers,
    data: { groupId: a.groupId, body: "x" },
  });
  expect(res.status()).toBe(404);
});
