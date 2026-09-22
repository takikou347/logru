import { AvatarSigner, avatarKey, expiryFor, isJpeg, randomAvatarToken, verifyAvatarUrl } from "@server/core/avatar";
import { describe, expect, it } from "vitest";

describe("アバターの写真の URL。#40", () => {
  const secret = "test-secret";
  const now = Date.parse("2026-09-22T10:00:00Z");

  it("期限は協定世界時で翌日の終わり。0021 と同じ", () => {
    expect(new Date(expiryFor(now)).toISOString()).toBe("2026-09-23T23:59:59.999Z");
  });

  it("署名が合い、期限の中なら通す", async () => {
    const url = await new AvatarSigner(secret, now).url("u1", "tok1");
    const q = new URL(url, "https://logru.test").searchParams;
    expect(url.startsWith("/api/me/avatar/u1/tok1?")).toBe(true);
    expect(await verifyAvatarUrl(secret, "u1", "tok1", Number(q.get("e")), q.get("s")!, now)).toBe(true);
  });

  it("別の人、別の token、期限切れ、別の鍵、壊れた署名は断る", async () => {
    const url = await new AvatarSigner(secret, now).url("u1", "tok1");
    const q = new URL(url, "https://logru.test").searchParams;
    const e = Number(q.get("e"));
    const s = q.get("s")!;
    expect(await verifyAvatarUrl(secret, "u2", "tok1", e, s, now)).toBe(false);
    expect(await verifyAvatarUrl(secret, "u1", "tok2", e, s, now)).toBe(false);
    expect(await verifyAvatarUrl(secret, "u1", "tok1", e, s, e + 1)).toBe(false);
    expect(await verifyAvatarUrl("other", "u1", "tok1", e, s, now)).toBe(false);
    expect(await verifyAvatarUrl(secret, "u1", "tok1", e, "!!", now)).toBe(false);
  });

  it("鍵が無ければ止める", async () => {
    await expect(new AvatarSigner(undefined, now).url("u1", "tok1")).rejects.toThrow(/AVATAR_PHOTO_KEY/);
  });

  it("頭文字を選んでいるか、写真の token が無ければ URL を作らない", async () => {
    const signer = new AvatarSigner(secret, now);
    expect(await signer.urlOf("u1", "initial", "tok1")).toBeNull();
    expect(await signer.urlOf("u1", "photo", null)).toBeNull();
    expect(await signer.urlOf("u1", "photo", "tok1")).toBe(await signer.url("u1", "tok1"));
  });

  it("R2 の鍵は利用者ごと、token ごとに分かれる", () => {
    expect(avatarKey("u1", "tok1")).toBe("a/u1/tok1.jpg");
    expect(avatarKey("u1", "tok2")).not.toBe(avatarKey("u1", "tok1"));
  });

  it("token は毎回ちがう乱数", () => {
    expect(randomAvatarToken()).not.toBe(randomAvatarToken());
  });

  it("JPEG の頭のバイトを見分ける", () => {
    expect(isJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(isJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
  });
});
