import { afterEach, describe, expect, it, vi } from "vitest";
import { canShareFiles, sharePhoto } from "../../src/client/lib/web-share";

describe("canShareFiles。ファイルの共有シートを出せるか見分ける。#258", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("canShare がファイルの共有に対応していれば true", () => {
    expect(canShareFiles({ canShare: () => true })).toBe(true);
  });

  it("canShare がファイルの共有を断れば false", () => {
    expect(canShareFiles({ canShare: () => false })).toBe(false);
  });

  it("navigator.canShare が無い端末では false", () => {
    expect(canShareFiles({})).toBe(false);
    vi.stubGlobal("navigator", {});
    expect(canShareFiles()).toBe(false);
  });

  it("canShare が投げても、共有できない扱いにする", () => {
    expect(
      canShareFiles({
        canShare: () => {
          throw new Error("not supported");
        },
      }),
    ).toBe(false);
  });
});

describe("sharePhoto。写真を端末の共有シートで送る。#258", () => {
  it("File を渡して navigator.share を呼ぶ", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const file = new File([new Uint8Array([1])], "photo.jpg", { type: "image/jpeg" });
    await sharePhoto(file, { title: "Logru" }, { share });
    expect(share).toHaveBeenCalledWith({ title: "Logru", files: [file] });
  });

  it("使う人がシートを閉じると、navigator.share の reject をそのまま返す", async () => {
    const abort = new DOMException("aborted", "AbortError");
    const share = vi.fn().mockRejectedValue(abort);
    const file = new File([], "photo.jpg", { type: "image/jpeg" });
    await expect(sharePhoto(file, {}, { share })).rejects.toBe(abort);
  });
});
