import { b64url, encryptPayload, fromB64url, vapidAuthorization } from "@server/core/push/web-push";
import { isKnownPushHost, pushSubscriptionInput } from "@shared/schemas";
import { describe, expect, it } from "vitest";

/** 端末の側で、RFC 8291 のとおりに解く。送る側の暗号が正しいかを確かめる */
async function decrypt(
  body: Uint8Array,
  ua: CryptoKeyPair,
  uaPublic: Uint8Array,
  authSecret: Uint8Array,
): Promise<string> {
  const salt = body.slice(0, 16);
  const idlen = body[20]!;
  const asPublic = body.slice(21, 21 + idlen);
  const cipher = body.slice(21 + idlen);
  const asKey = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: asKey } as never, ua.privateKey, 256),
  );
  const hkdf = async (s: Uint8Array, ikm: Uint8Array, info: Uint8Array, n: number) =>
    new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: "HKDF", hash: "SHA-256", salt: s, info },
        await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]),
        n * 8,
      ),
    );
  const enc = new TextEncoder();
  const info = new Uint8Array([...enc.encode("WebPush: info\0"), ...uaPublic, ...asPublic]);
  const ikm = await hkdf(authSecret, shared, info, 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, cipher));
  expect(plain.at(-1)).toBe(2);
  return new TextDecoder().decode(plain.slice(0, -1));
}

describe("Web Push", () => {
  it("本文を aes128gcm で暗号にし、端末の鍵で解ける。0023", async () => {
    const ua = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
      "deriveBits",
    ])) as CryptoKeyPair;
    const uaPublic = new Uint8Array((await crypto.subtle.exportKey("raw", ua.publicKey)) as ArrayBuffer);
    const authSecret = crypto.getRandomValues(new Uint8Array(16));
    const payload = JSON.stringify({ title: "箱根 1 泊", body: "14 時のひとコマを残せます" });
    const body = await encryptPayload(payload, {
      endpoint: "https://push.example/x",
      p256dh: b64url(uaPublic),
      auth: b64url(authSecret),
    });
    expect(new DataView(body.buffer).getUint32(16)).toBe(4096);
    expect(await decrypt(body, ua, uaPublic, authSecret)).toBe(payload);
  });

  it("VAPID の JWT は宛先のオリジンを持ち、公開鍵で確かめられる", async () => {
    const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
    const pub = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
    const header = await vapidAuthorization(
      "https://fcm.googleapis.com/fcm/send/abc",
      { publicKey: b64url(pub), privateKey: jwk.d!, subject: "mailto:a@example.com" },
      0,
    );
    const [, token, k] = header.match(/^vapid t=([^,]+), k=(.+)$/)!;
    expect(k).toBe(b64url(pub));
    const [h, c, s] = token!.split(".");
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(c!)));
    expect(claims).toMatchObject({ aud: "https://fcm.googleapis.com", sub: "mailto:a@example.com", exp: 12 * 3600 });
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pair.publicKey,
      fromB64url(s!),
      new TextEncoder().encode(`${h}.${c}`),
    );
    expect(ok).toBe(true);
  });
});

describe("isKnownPushHost。任意の https を送り先に登録させない。0065、#161", () => {
  it("ブラウザーの会社の送り先は通す", () => {
    expect(isKnownPushHost("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isKnownPushHost("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(isKnownPushHost("https://web.push.apple.com/abc")).toBe(true);
    expect(isKnownPushHost("https://wns2-xyz.notify.windows.com/w/abc")).toBe(true);
  });

  it("知らないホストと、壊れた URL は断る", () => {
    expect(isKnownPushHost("https://push.example/x")).toBe(false);
    expect(isKnownPushHost("not a url")).toBe(false);
  });
});

describe("pushSubscriptionInput。0065、#161", () => {
  const keys = { p256dh: "p", auth: "a" };

  it("知られたホストの https だけを通す", () => {
    expect(pushSubscriptionInput.safeParse({ endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys }).success).toBe(
      true,
    );
    expect(pushSubscriptionInput.safeParse({ endpoint: "https://push.example/x", keys }).success).toBe(false);
    expect(pushSubscriptionInput.safeParse({ endpoint: "http://fcm.googleapis.com/fcm/send/abc", keys }).success).toBe(
      false,
    );
  });
});
