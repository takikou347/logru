/**
 * 写真の置き場と、期限付きの署名の URL。0021
 *
 * `img` の要求には ID トークンを付けられない。URL に期限と署名を入れ、Worker は署名と期限だけを確かめて R2 から返す。
 * 期限は協定世界時で翌日の終わり。同じ日のうちは同じ URL になり、ブラウザーの手元の写しが効く。
 */
import type { Photo } from "../shared/types";
import type { MemoryPhotoRow } from "./schema";

export type PhotoSize = "full" | "thumb";

/** R2 の鍵。full はそのまま、thumb は末尾を `_t.jpg` にする */
export function photoKey(groupId: string, photoId: string, size: PhotoSize): string {
  return `m/${groupId}/${photoId}${size === "thumb" ? "_t" : ""}.jpg`;
}

/**
 * URL の期限。いまから見て、協定世界時で翌日の終わり。最長 2 日。F-124
 * @param now いまの時刻。ミリ秒の UTC
 */
export function expiryFor(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 2) - 1;
}

const encoder = new TextEncoder();

/** 署名の鍵を読み込む。鍵が無ければ、写真を配れないので止める */
async function importKey(secret: string | undefined): Promise<CryptoKey> {
  if (!secret) throw new Error("MEMORIES_PHOTO_KEY が置かれていません。");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function toBase64Url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(s: string): Uint8Array | null {
  try {
    const bin = atob(s.replaceAll("-", "+").replaceAll("_", "/"));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

const message = (photoId: string, size: PhotoSize, expires: number) => encoder.encode(`${photoId}.${size}.${expires}`);

/** 写真の URL を作る。同じ日のうちは同じ値になる */
export class PhotoSigner {
  private key: Promise<CryptoKey>;
  private expires: number;

  /**
   * @param secret HMAC-SHA256 の鍵。Worker の MEMORIES_PHOTO_KEY
   * @param now いまの時刻
   */
  constructor(secret: string | undefined, now = Date.now()) {
    this.key = importKey(secret);
    this.expires = expiryFor(now);
  }

  async url(photoId: string, size: PhotoSize): Promise<string> {
    const sig = await crypto.subtle.sign("HMAC", await this.key, message(photoId, size, this.expires));
    return `/api/memories/photos/${photoId}/${size}?e=${this.expires}&s=${toBase64Url(sig)}`;
  }

  /** 表の 1 行を、画面に返す形にする */
  async photo(row: MemoryPhotoRow): Promise<Photo> {
    const [thumbUrl, fullUrl] = await Promise.all([this.url(row.id, "thumb"), this.url(row.id, "full")]);
    return {
      id: row.id,
      width: row.width,
      height: row.height,
      takenAt: row.takenAt?.getTime() ?? null,
      tiny: row.tiny,
      thumbUrl,
      fullUrl,
    };
  }
}

/**
 * URL の署名と期限を確かめる。
 * @param secret 署名の鍵
 * @param photoId 写真の ID
 * @param size 大きさ
 * @param expires URL の e
 * @param signature URL の s
 * @param now いまの時刻
 */
export async function verifyPhotoUrl(
  secret: string | undefined,
  photoId: string,
  size: PhotoSize,
  expires: number,
  signature: string,
  now = Date.now(),
): Promise<boolean> {
  if (!Number.isFinite(expires) || expires < now) return false;
  const sig = fromBase64Url(signature);
  if (!sig) return false;
  return crypto.subtle.verify("HMAC", await importKey(secret), sig, message(photoId, size, expires));
}

/** JPEG の頭のバイトか。FF D8 FF で始まる */
export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}
