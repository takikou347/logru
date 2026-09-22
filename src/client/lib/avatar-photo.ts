/**
 * アバターの写真を、送る前に端末で 256 px の正方形の JPEG に縮める。#40
 *
 * 思い出の写真（0021）と同じ考え方。真ん中を正方形に切り抜き、作り直して Exif ごと消す。位置の情報も残らない。
 */

/** サーバーの AVATAR_SIZE、AVATAR_MAX_BYTES と合わせる */
const AVATAR_SIZE = 256;
const MAX_BYTES = 200 * 1024;

/**
 * 写真を 256 px の正方形の JPEG に作り直す。
 * @throws 読めない形式のとき。macOS の Chrome の HEIC など。大きさの上限に収まらないとき
 */
export async function prepareAvatarPhoto(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("この形式の写真は読めません。JPEG か PNG にしてから選んでください。");
  }
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("写真を処理できませんでした。");
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    let blob: Blob | null = null;
    for (const q of [0.85, 0.7, 0.55, 0.4]) {
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", q));
      if (blob && blob.size <= MAX_BYTES) break;
    }
    if (!blob || blob.size > MAX_BYTES) throw new Error("写真が大きすぎます。");
    return blob;
  } finally {
    bitmap.close();
  }
}
