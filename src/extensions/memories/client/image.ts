/**
 * 送る前に、端末で写真を縮める。0021
 *
 * full は長い辺 2048 px、thumb は 480 px、tiny は 32 px の JPEG にする。作り直すと Exif ごと消え、位置の情報も残らない。
 * 撮った時刻だけは、縮める前に Exif から読む。
 */
import exifr from "exifr";

export type PreparedPhoto = {
  full: Blob;
  thumb: Blob;
  tiny: string;
  width: number;
  height: number;
  takenAt: number | null;
};

/** 大きさの上限。サーバーの PHOTO_LIMITS と合わせる */
const MAX_FULL_BYTES = 3 * 1024 * 1024;
const MAX_THUMB_BYTES = 200 * 1024;

/**
 * 写真を 3 つの大きさの JPEG に作り直す。
 * @param file 選んだか撮った写真
 * @throws 読めない形式のとき。macOS の Chrome の HEIC など
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const takenAt = await readTakenAt(file);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("この形式の写真は読めません。JPEG か PNG にしてから選んでください。");
  }
  try {
    const full = await encode(bitmap, 2048, [0.85, 0.75, 0.6], MAX_FULL_BYTES);
    const thumb = await encode(bitmap, 480, [0.8, 0.65, 0.5], MAX_THUMB_BYTES);
    const tinyBlob = await encode(bitmap, 32, [0.6], Infinity);
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    return {
      full: full.blob,
      thumb: thumb.blob,
      tiny: await toDataUrl(tinyBlob.blob),
      width: Math.round(bitmap.width * scale),
      height: Math.round(bitmap.height * scale),
      takenAt,
    };
  } finally {
    bitmap.close();
  }
}

/** Exif の撮った時刻。無いか読めなければ null */
async function readTakenAt(file: File): Promise<number | null> {
  try {
    const data = (await exifr.parse(file, ["DateTimeOriginal", "CreateDate"])) as
      | { DateTimeOriginal?: Date; CreateDate?: Date }
      | undefined;
    const d = data?.DateTimeOriginal ?? data?.CreateDate;
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : null;
  } catch {
    return null;
  }
}

/**
 * 長い辺を max に縮めて JPEG にする。上限を超えたら品質を下げて作り直す。
 * @param qualities 試す品質。前から順に
 */
async function encode(bitmap: ImageBitmap, max: number, qualities: number[], limit: number): Promise<{ blob: Blob }> {
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("写真を処理できませんでした。");
  ctx.drawImage(bitmap, 0, 0, w, h);
  let blob: Blob | null = null;
  for (const q of qualities) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", q));
    if (blob && blob.size <= limit) break;
  }
  if (!blob || blob.size > limit) throw new Error("写真が大きすぎます。");
  return { blob };
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * 縮めた写真を送る。進み具合は、送った分の割合で返す。
 * @param groupId 写真を置くグループ
 * @param onProgress 0 から 1
 */
export async function uploadPhoto(
  groupId: string,
  photo: PreparedPhoto,
  token: string | undefined,
  onProgress: (ratio: number) => void,
): Promise<import("../shared/types").Photo> {
  const form = new FormData();
  form.set("groupId", groupId);
  form.set("full", photo.full, "full.jpg");
  form.set("thumb", photo.thumb, "thumb.jpg");
  form.set("tiny", photo.tiny);
  form.set("width", String(photo.width));
  form.set("height", String(photo.height));
  if (photo.takenAt) form.set("takenAt", String(photo.takenAt));
  // fetch では送った量が分からないので、XMLHttpRequest で送る
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/memories/photos");
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText || "{}") as { error?: string };
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as never);
      else reject(new Error(data.error ?? "写真を送れませんでした。もう一度試してください。"));
    };
    xhr.onerror = () => reject(new Error("通信できません。つながってから、もう一度試してください。"));
    xhr.send(form);
  });
}
