/**
 * アバターの写真の置き場と、期限つきの署名の URL。#40
 *
 * 思い出の写真（0021）と同じ考え方。鍵は AVATAR_PHOTO_KEY で分け、置き場も R2 の logru-avatars で分ける。
 * `img` の要求には ID トークンを付けられないので、URL に期限と署名を入れ、Worker は署名と期限だけを確かめて R2 から返す。
 *
 * 1 人 1 枚。置き直すたびに token を作り直し、前の URL を古くする。同じ日のうちは同じ URL になり、ブラウザーの手元の写しが効く。
 */

/** 写真の大きさの上限。200 KB */
export const AVATAR_MAX_BYTES = 200 * 1024;

/** 正方形に縮める大きさ。px */
export const AVATAR_SIZE = 256;

/** R2 の鍵。token は置くたびに変わる乱数 */
export function avatarKey(userId: string, token: string): string {
  return `a/${userId}/${token}.jpg`;
}

/** 推測できない token を作る。16 バイトの乱数を URL で使える Base64 にする */
export function randomAvatarToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return toBase64Url(bytes.buffer);
}

/**
 * URL の期限。いまから見て、協定世界時で翌日の終わり。最長 2 日。0021 と同じ
 * @param now いまの時刻。ミリ秒の UTC
 */
export function expiryFor(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 2) - 1;
}

const encoder = new TextEncoder();

/** 署名の鍵を読み込む。鍵が無ければ、アバターの写真を配れないので止める */
async function importKey(secret: string | undefined): Promise<CryptoKey> {
  if (!secret) throw new Error("AVATAR_PHOTO_KEY が置かれていません。");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

function toBase64Url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function fromBase64Url(s: string): Uint8Array | null {
  try {
    const bin = atob(s.replaceAll("-", "+").replaceAll("_", "/"));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

const message = (userId: string, token: string, expires: number) => encoder.encode(`${userId}.${token}.${expires}`);

/** アバターの写真の URL を作る。同じ日のうちは同じ値になる */
export class AvatarSigner {
  private key: Promise<CryptoKey>;
  private expires: number;

  /**
   * @param secret HMAC-SHA256 の鍵。Worker の AVATAR_PHOTO_KEY
   * @param now いまの時刻
   */
  constructor(secret: string | undefined, now = Date.now()) {
    this.key = importKey(secret);
    this.expires = expiryFor(now);
  }

  async url(userId: string, token: string): Promise<string> {
    const sig = await crypto.subtle.sign("HMAC", await this.key, message(userId, token, this.expires));
    return `/api/me/avatar/${userId}/${token}?e=${this.expires}&s=${toBase64Url(sig)}`;
  }

  /**
   * その人のいまのアバターの URL。頭文字を選んでいるか、写真が無ければ null
   * @param kind avatar_kind の値
   * @param token avatar_photo_key の値
   */
  async urlOf(userId: string, kind: "initial" | "photo", token: string | null): Promise<string | null> {
    return kind === "photo" && token ? this.url(userId, token) : null;
  }
}

/**
 * URL の署名と期限を確かめる。
 * @param secret 署名の鍵
 * @param userId 利用者の ID
 * @param token URL の token
 * @param expires URL の e
 * @param signature URL の s
 * @param now いまの時刻
 */
export async function verifyAvatarUrl(
  secret: string | undefined,
  userId: string,
  token: string,
  expires: number,
  signature: string,
  now = Date.now(),
): Promise<boolean> {
  if (!Number.isFinite(expires) || expires < now) return false;
  const sig = fromBase64Url(signature);
  if (!sig) return false;
  return crypto.subtle.verify("HMAC", await importKey(secret), sig, message(userId, token, expires));
}

/** JPEG の頭のバイトか。FF D8 FF で始まる */
export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}
