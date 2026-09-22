import { and, eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { LEGAL_VERSIONS, type LegalDocument } from "@shared/legal";
import { ensureUser } from "@server/modules/users/onboarding";
import { type AppEnv, HttpError, isLocalDev } from "@server/core/app";
import { legalAgreements } from "@server/core/db/schema";
import { InvalidTokenError, verifyFirebaseToken } from "@server/core/auth/verify-token";

/**
 * ログインしていなければ 401 を返す。通れば c.get("user") に利用者が入る。
 *
 * `Authorization: Bearer <Firebase の ID トークン>` を確かめ、D1 の users 表の行を用意する。
 * メールとパスワードで登録した人は、メールアドレスを確かめるまで 403 にする。
 * cookie を使わないので、別のサイトから書き込ませる攻撃は成り立たない。
 */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new HttpError(401, "ログインしてください。", "UNAUTHENTICATED");

  // エミュレーターのトークンは、手元の開発で、エミュレーターを使う設定のときだけ受け付ける
  const emulator = isLocalDev(c.env, c.req.url) && Boolean(c.env.FIREBASE_AUTH_EMULATOR_HOST);
  let claims: Awaited<ReturnType<typeof verifyFirebaseToken>>;
  try {
    claims = await verifyFirebaseToken(token, { projectId: c.env.FIREBASE_PROJECT_ID, emulator });
  } catch (e) {
    if (e instanceof InvalidTokenError) throw new HttpError(401, "ログインし直してください。", "UNAUTHENTICATED");
    throw e;
  }
  if (claims.provider === "password" && !claims.emailVerified) {
    throw new HttpError(403, "メールアドレスを確かめてください。届いたメールのリンクを開いてください。", "EMAIL_NOT_VERIFIED");
  }

  const user = await ensureUser(c.get("db"), claims);
  c.set("user", { ...user, provider: claims.provider });
  await next();
});

/**
 * 最新の規約に同意していなければ 403 を返す。requireUser の後に置く。
 * 同意の画面と、自分の情報を読む API と、退会の API には置かない。
 */
export const requireAgreement = createMiddleware<AppEnv>(async (c, next) => {
  const missing = await missingAgreements(c.get("db"), c.get("user").id);
  if (missing.length > 0) {
    throw new HttpError(403, "利用規約とプライバシーポリシーに同意してください。", "LEGAL_NOT_AGREED");
  }
  await next();
});

/**
 * まだ同意していない文書を返す。空なら最新の版にすべて同意している。
 * @param db D1 を包んだ Drizzle
 * @param userId 利用者の ID
 */
export async function missingAgreements(db: AppEnv["Variables"]["db"], userId: string): Promise<LegalDocument[]> {
  const agreed = await db.select().from(legalAgreements).where(and(eq(legalAgreements.userId, userId)));
  return (Object.keys(LEGAL_VERSIONS) as LegalDocument[]).filter(
    (doc) => !agreed.some((a) => a.document === doc && a.version === LEGAL_VERSIONS[doc]),
  );
}
