import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import type { DB } from "./db/client";
import { schema } from "./db/client";
import { loginFailure } from "./db/schema";
import { lockedUntil, recordFailure } from "./lib/login-lock";
import { resetPasswordMail, sendMail, verificationMail } from "./lib/mail";
import { hashPassword, verifyPassword } from "./lib/password";
import { setUpNewUser } from "./services/onboarding";

type Secrets = { BETTER_AUTH_SECRET?: string; GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string };

export function googleEnabled(env: Env): boolean {
  const s = env as Env & Secrets;
  return Boolean(s.GOOGLE_CLIENT_ID && s.GOOGLE_CLIENT_SECRET);
}

function normalizeEmail(email: unknown): string | null {
  return typeof email === "string" ? email.trim().toLowerCase() : null;
}

export function createAuth(env: Env, db: DB, appUrl: string, localDev: boolean) {
  const secrets = env as Env & Secrets;
  const secret = secrets.BETTER_AUTH_SECRET;
  // 手元の開発のときだけ、決まった鍵で動かす。それ以外で鍵が無ければ動かさない
  if (!secret && !localDev) throw new Error("BETTER_AUTH_SECRET が無い");

  return betterAuth({
    appName: "Logru",
    baseURL: appUrl,
    basePath: "/api/auth",
    secret: secret ?? "development-only-secret-do-not-use-in-production",
    trustedOrigins: [appUrl],
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      password: { hash: hashPassword, verify: verifyPassword },
      sendResetPassword: async ({ user, url }) => {
        await sendMail(env, db, resetPasswordMail(user.email, url), localDev);
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, url }) => {
        await sendMail(env, db, verificationMail(user.email, url), localDev);
      },
    },
    socialProviders: googleEnabled(env)
      ? {
          google: {
            clientId: secrets.GOOGLE_CLIENT_ID!,
            clientSecret: secrets.GOOGLE_CLIENT_SECRET!,
            prompt: "select_account",
          },
        }
      : {},
    // 手元のアドレスが未確認なら Google をまとめない。Better Auth の既定と同じ。F-04
    account: { accountLinking: { enabled: true, requireLocalEmailVerified: true } },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    user: { deleteUser: { enabled: false } },
    databaseHooks: {
      user: {
        create: {
          after: async (user, ctx) => {
            const body = (ctx?.body ?? {}) as { agreedToLegal?: unknown };
            await setUpNewUser(db, user.id, body.agreedToLegal === true);
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/sign-up/email") {
          const body = ctx.body as { agreedToLegal?: unknown } | undefined;
          if (body?.agreedToLegal !== true) {
            throw new APIError("BAD_REQUEST", {
              code: "LEGAL_NOT_AGREED",
              message: "利用規約とプライバシーポリシーに同意してください。",
            });
          }
        }
        if (ctx.path === "/sign-in/email") {
          const email = normalizeEmail((ctx.body as { email?: unknown } | undefined)?.email);
          if (!email) return;
          const row = await db.query.loginFailure.findFirst({ where: eq(loginFailure.email, email) });
          const until = lockedUntil(row ? { count: row.count, lockedUntil: row.lockedUntil?.getTime() ?? null } : undefined, Date.now());
          if (until) {
            throw new APIError("TOO_MANY_REQUESTS", {
              code: "LOGIN_LOCKED",
              message: "ログインを一時的に止めています。",
              lockedUntil: until,
            });
          }
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/email") return;
        const email = normalizeEmail((ctx.body as { email?: unknown } | undefined)?.email);
        if (!email) return;
        const returned = ctx.context.returned;
        const failed = isAPIError(returned) && returned.statusCode === 401;
        if (!failed) {
          if (!isAPIError(returned)) await db.delete(loginFailure).where(eq(loginFailure.email, email));
          return;
        }
        const row = await db.query.loginFailure.findFirst({ where: eq(loginFailure.email, email) });
        const next = recordFailure(
          row ? { count: row.count, lockedUntil: row.lockedUntil?.getTime() ?? null } : undefined,
          Date.now(),
        );
        const values = {
          count: next.count,
          lockedUntil: next.lockedUntil ? new Date(next.lockedUntil) : null,
          updatedAt: new Date(),
        };
        await db
          .insert(loginFailure)
          .values({ email, ...values })
          .onConflictDoUpdate({ target: loginFailure.email, set: values });
        if (next.lockedUntil) {
          throw new APIError("TOO_MANY_REQUESTS", {
            code: "LOGIN_LOCKED",
            message: "ログインを一時的に止めています。",
            lockedUntil: next.lockedUntil,
          });
        }
        throw new APIError("UNAUTHORIZED", {
          code: "INVALID_EMAIL_OR_PASSWORD",
          message: "メールアドレスかパスワードが違います。",
          remaining: next.remaining,
        });
      }),
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
