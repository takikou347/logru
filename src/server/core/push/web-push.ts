/**
 * Web Push を、ライブラリなしで Workers の WebCrypto だけで送る。0023
 *
 * - 本文の暗号は RFC 8291 と RFC 8188 の aes128gcm
 * - 送り手を示すのは RFC 8292 の VAPID。ES256 の JWT を付ける
 */

const enc = new TextEncoder();

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function fromB64url(s: string): Uint8Array {
  const bin = atob(s.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
}

/** HKDF-SHA-256。抽出と展開を 1 回で行う */
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}

/** 端末の送り先。ブラウザーの PushSubscription の中身 */
export type PushTarget = { endpoint: string; p256dh: string; auth: string };

/** VAPID の鍵。公開鍵は 65 バイトの非圧縮点、秘密鍵は 32 バイト。どちらも base64url */
export type VapidKeys = { publicKey: string; privateKey: string; subject: string };

/**
 * 本文を aes128gcm で暗号にする。RFC 8291
 * @param payload 送る本文。JSON の文字列
 * @param target 端末の送り先
 */
export async function encryptPayload(payload: string, target: PushTarget): Promise<Uint8Array> {
  const uaPublic = fromB64url(target.p256dh);
  const authSecret = fromB64url(target.auth);
  const local = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const asPublic = new Uint8Array((await crypto.subtle.exportKey("raw", local.publicKey)) as ArrayBuffer);
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  // 標準の名前は public。Workers の型は $public と書くので、両方を渡す
  const ecdh = { name: "ECDH", public: uaKey, $public: uaKey } as unknown as SubtleCryptoDeriveKeyAlgorithm;
  const shared = new Uint8Array(await crypto.subtle.deriveBits(ecdh, local.privateKey, 256));

  const ikm = await hkdf(authSecret, shared, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  // 最後の記録の区切りは 0x02。詰め物は入れない
  const plain = concat(enc.encode(payload), new Uint8Array([2]));
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, plain));

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, cipher);
}

/**
 * VAPID の JWT を作る。宛先は送り先のオリジン、期限は 12 時間。RFC 8292
 * @param endpoint 端末の送り先の URL
 */
export async function vapidAuthorization(endpoint: string, keys: VapidKeys, now = Date.now()): Promise<string> {
  const pub = fromB64url(keys.publicKey);
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: b64url(pub.slice(1, 33)),
    y: b64url(pub.slice(33, 65)),
    d: keys.privateKey,
    ext: true,
  };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(
    enc.encode(
      JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: keys.subject }),
    ),
  );
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${b64url(sig)}, k=${keys.publicKey}`;
}

/**
 * 1 つの端末へ送る。
 * @returns 送り先の HTTP の状態。404 と 410 は、その送り先がもう使えない
 */
export async function sendWebPush(target: PushTarget, payload: string, keys: VapidKeys): Promise<number> {
  const body = await encryptPayload(payload, target);
  const res = await fetch(target.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidAuthorization(target.endpoint, keys),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "600",
      Urgency: "normal",
    },
    body,
  });
  return res.status;
}
