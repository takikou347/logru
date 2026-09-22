import { SignJWT, UnsecuredJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { InvalidTokenError, verifyFirebaseToken } from "@server/core/auth/verify-token";

const PROJECT = "logru-test";
const ISS = `https://securetoken.google.com/${PROJECT}`;

let sign: (claims: Record<string, unknown>, opts?: { aud?: string; iss?: string; exp?: string }) => Promise<string>;
let keys: ReturnType<typeof createLocalJWKSet>;
let otherSign: (claims: Record<string, unknown>) => Promise<string>;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
  keys = createLocalJWKSet({ keys: [jwk] });
  sign = (claims, opts = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(opts.iss ?? ISS)
      .setAudience(opts.aud ?? PROJECT)
      .setSubject("uid-1")
      .setIssuedAt()
      .setExpirationTime(opts.exp ?? "1h")
      .sign(pair.privateKey);
  const other = await generateKeyPair("RS256");
  otherSign = (claims) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(ISS)
      .setAudience(PROJECT)
      .setSubject("uid-1")
      .setExpirationTime("1h")
      .sign(other.privateKey);
});

const google = { email: "a@example.com", email_verified: true, name: "こた", firebase: { sign_in_provider: "google.com" } };

describe("verifyFirebaseToken", () => {
  it("正しい署名のトークンから、利用者の情報を取り出す", async () => {
    const claims = await verifyFirebaseToken(await sign(google), { projectId: PROJECT, keys });
    expect(claims).toEqual({
      uid: "uid-1",
      email: "a@example.com",
      emailVerified: true,
      name: "こた",
      picture: null,
      provider: "google.com",
    });
  });

  it("別の鍵で署名したトークンは受け付けない", async () => {
    await expect(verifyFirebaseToken(await otherSign(google), { projectId: PROJECT, keys })).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
  });

  it("ほかのプロジェクト宛てのトークンは受け付けない", async () => {
    const token = await sign(google, { aud: "someone-else" });
    await expect(verifyFirebaseToken(token, { projectId: PROJECT, keys })).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("期限の切れたトークンは受け付けない", async () => {
    const token = await sign(google, { exp: "-1m" });
    await expect(verifyFirebaseToken(token, { projectId: PROJECT, keys })).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("署名の無いトークンは、エミュレーターを許したときだけ受け付ける", async () => {
    const unsigned = new UnsecuredJWT({ ...google, sub: "uid-2" })
      .setIssuer(ISS)
      .setAudience(PROJECT)
      .setExpirationTime("1h")
      .encode();
    await expect(verifyFirebaseToken(unsigned, { projectId: PROJECT, keys })).rejects.toBeInstanceOf(InvalidTokenError);
    const claims = await verifyFirebaseToken(unsigned, { projectId: PROJECT, emulator: true });
    expect(claims.uid).toBe("uid-2");
  });

  it("エミュレーターでも、宛先の違うトークンは受け付けない", async () => {
    const unsigned = new UnsecuredJWT(google).setIssuer(ISS).setAudience("x").setSubject("u").setExpirationTime("1h").encode();
    await expect(verifyFirebaseToken(unsigned, { projectId: PROJECT, emulator: true })).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
  });
});
