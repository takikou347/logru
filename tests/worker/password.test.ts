import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../src/worker/lib/password";

describe("password", () => {
  it("同じパスワードなら通り、違えば通らない", async () => {
    const hash = await hashPassword("correct horse");
    expect(hash).toMatch(/^pbkdf2\$100000\$/);
    expect(await verifyPassword({ hash, password: "correct horse" })).toBe(true);
    expect(await verifyPassword({ hash, password: "wrong horse" })).toBe(false);
  });

  it("同じパスワードでも塩が違うので毎回別のハッシュになる", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("形の崩れたハッシュは通さない", async () => {
    expect(await verifyPassword({ hash: "plain", password: "plain" })).toBe(false);
  });
});
