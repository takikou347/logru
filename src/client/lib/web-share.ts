/**
 * 端末の共有シートで、写真(ファイル)や文字を送る。#258、issue #227
 * 共有したことは記録しない。写真は Web Share API の Level 2(ファイルの共有)。技術の遊びとして足すだけの、小さな道具。
 */

/** ファイルの共有に対応しているかを、実際に写真を読み込まずに見分けるためだけの、ダミーの JPEG */
function dummyJpegFile(): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff])], "photo.jpg", { type: "image/jpeg" });
}

/**
 * 写真を端末の共有シートで送れるか。`navigator.canShare` が無い、またはファイルの共有に対応していない
 * 端末では false。ボタンを出すかどうかを、実際に写真を読み込む前に見分けるために使う
 */
export function canShareFiles(nav: Partial<Pick<Navigator, "canShare">> | undefined = globalThis.navigator): boolean {
  try {
    return Boolean(nav?.canShare?.({ files: [dummyJpegFile()] }));
  } catch {
    return false;
  }
}

/** 写真の URL から、共有シートへ渡す File を作る */
export async function photoShareFile(url: string, filename: string): Promise<File> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("写真を読み込めませんでした。");
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}

/** 写真を端末の共有シートで送る */
export function sharePhoto(
  file: File,
  meta: { title?: string; text?: string } = {},
  nav: Pick<Navigator, "share"> = globalThis.navigator,
): Promise<void> {
  return nav.share({ ...meta, files: [file] });
}

/**
 * 文字を端末の共有シートで送る。無い端末(PC の一部)は、代わりにクリップボードへコピーする。issue #227
 * 呼び出す側は、送るのをやめただけ(AbortError)を失敗として扱わないこと
 * @returns 実際に使った方法
 */
export async function shareText(
  data: { title?: string; text: string },
  nav: Pick<Navigator, "share" | "clipboard"> = globalThis.navigator,
): Promise<"shared" | "copied"> {
  if (typeof nav.share === "function") {
    await nav.share(data);
    return "shared";
  }
  await nav.clipboard.writeText(data.text);
  return "copied";
}
