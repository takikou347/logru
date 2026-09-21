import { type JWTPayload, type JWTVerifyGetKey, createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";

/** Firebase の ID トークンの中身のうち、使うもの */
export type FirebaseClaims = {
  /** Firebase の利用者 ID */
  uid: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
  /** `google.com` か `password` */
  provider: string;
};

/** Firebase が ID トークンに署名する鍵の置き場所。Google が公開している */
const FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

// 鍵は Worker の同じ実行の中で使い回す。jose が期限に合わせて取り直す
let remoteKeys: JWTVerifyGetKey | undefined;
function firebaseKeys(): JWTVerifyGetKey {
  remoteKeys ??= createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));
  return remoteKeys;
}

/** トークンを受け付けないときに投げる。middleware が 401 にする */
export class InvalidTokenError extends Error {}

/**
 * Firebase の ID トークンを確かめて、中身を返す。
 *
 * 本物のトークンは、Google の公開鍵で署名を確かめる。発行元と宛先がこのプロジェクトであること、
 * 期限内であること、ログインした時刻が未来でないことも確かめる。
 *
 * `emulator` が true のときだけ、Firebase のエミュレーターが出す署名の無いトークンを受け付ける。
 * 呼ぶ側は、手元の開発のときにしか true を渡してはいけない。
 *
 * @param token `Authorization: Bearer` の後ろの文字列
 * @param opts.projectId Firebase のプロジェクト ID
 * @param opts.emulator エミュレーターのトークンを受け付けるか
 * @param opts.keys 署名の鍵。テストで差し替える
 * @throws {InvalidTokenError} 受け付けないとき
 */
export async function verifyFirebaseToken(
  token: string,
  opts: { projectId: string; emulator?: boolean; keys?: JWTVerifyGetKey },
): Promise<FirebaseClaims> {
  const issuer = `https://securetoken.google.com/${opts.projectId}`;
  let payload: JWTPayload;
  try {
    if (opts.emulator) {
      payload = decodeJwt(token);
      if (payload.iss !== issuer || payload.aud !== opts.projectId) throw new Error("宛先が違う");
      if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) throw new Error("期限切れ");
    } else {
      ({ payload } = await jwtVerify(token, opts.keys ?? firebaseKeys(), {
        issuer,
        audience: opts.projectId,
        algorithms: ["RS256"],
      }));
    }
  } catch (e) {
    throw new InvalidTokenError((e as Error).message);
  }

  const authTime = payload.auth_time;
  if (!payload.sub || (typeof authTime === "number" && authTime * 1000 > Date.now() + 60_000)) {
    throw new InvalidTokenError("中身が正しくない");
  }
  const firebase = (payload.firebase ?? {}) as { sign_in_provider?: string };
  return {
    uid: payload.sub,
    email: String(payload.email ?? ""),
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === "string" ? payload.name : null,
    picture: typeof payload.picture === "string" ? payload.picture : null,
    provider: firebase.sign_in_provider ?? "unknown",
  };
}
