/**
 * 外部のカレンダーの URL を暗号にする。AES-GCM の 256 ビット。
 * 鍵は環境変数 EXTERNAL_CALENDAR_KEY に、32 バイトを base64 にして置く。
 * 暗号にした形は `v1:<base64(iv 12 バイト + 暗号文)>`。
 */

const PREFIX = "v1:";
const keyCache = new Map<string, Promise<CryptoKey>>();

/** 鍵が無いか壊れているとき */
export class MissingKeyError extends Error {}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const s = atob(text);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

/**
 * base64 の鍵を読み込む。同じ鍵は使い回す。
 * @throws {MissingKeyError} 鍵が無いか、32 バイトでないとき
 */
function importKey(base64Key: string | undefined): Promise<CryptoKey> {
  if (!base64Key) throw new MissingKeyError("EXTERNAL_CALENDAR_KEY がありません。");
  let key = keyCache.get(base64Key);
  if (!key) {
    let raw: Uint8Array<ArrayBuffer>;
    try {
      raw = fromBase64(base64Key);
    } catch {
      throw new MissingKeyError("EXTERNAL_CALENDAR_KEY が base64 ではありません。");
    }
    if (raw.length !== 32) throw new MissingKeyError("EXTERNAL_CALENDAR_KEY は 32 バイトにしてください。");
    key = crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
    keyCache.set(base64Key, key);
  }
  return key;
}

/**
 * 文字列を暗号にする。同じ文字列でも、毎回ちがう結果になる。
 * @param plain 暗号にする文字列
 * @param base64Key EXTERNAL_CALENDAR_KEY
 */
export async function encryptText(plain: string, base64Key: string | undefined): Promise<string> {
  const key = await importKey(base64Key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)));
  const out = new Uint8Array(iv.length + sealed.length);
  out.set(iv);
  out.set(sealed, iv.length);
  return PREFIX + toBase64(out);
}

/**
 * encryptText で暗号にしたものを戻す。
 * @throws 鍵が違うか、書き換えられていたとき
 */
export async function decryptText(sealed: string, base64Key: string | undefined): Promise<string> {
  if (!sealed.startsWith(PREFIX)) throw new Error("暗号の形が違います。");
  const key = await importKey(base64Key);
  const bytes = fromBase64(sealed.slice(PREFIX.length));
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, key, bytes.slice(12));
  return new TextDecoder().decode(plain);
}
