import { type Context, Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { Auth } from "./auth";
import type { DB } from "./db/client";

export type SessionUser = { id: string; name: string; email: string; emailVerified: boolean; image?: string | null };

export type AppEnv = {
  Bindings: Env;
  Variables: { db: DB; auth: Auth; user: SessionUser; appUrl: string };
};

/**
 * 画面の URL。本番は APP_URL に固定する。
 * 開発では、開発サーバーと本番と同じ形の確認で番号が違うので、要求が来た出どころを使う。
 */
export function resolveAppUrl(env: Env, requestUrl: string): string {
  if (env.ENVIRONMENT === "development") return new URL(requestUrl).origin;
  return new URL(env.APP_URL).origin;
}

export const createRouter = () => new Hono<AppEnv>();

/** ログインしていなければ 401 を返す */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const session = await c.get("auth").api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "ログインしてください。" }, 401);
  c.set("user", session.user as SessionUser);
  await next();
});

/** 書き換える要求は、同じ出どころからだけ受ける */
export const sameOrigin = createMiddleware<AppEnv>(async (c, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    const origin = c.req.header("Origin");
    if (origin && origin !== c.get("appUrl")) {
      return c.json({ error: "許可されていない出どころです。" }, 403);
    }
  }
  await next();
});

/** zValidator の失敗を、最初の 1 件の文言で 400 にして返す */
export function validationHook(
  result: { success: boolean; error?: { issues: readonly { message: string }[] } },
  c: Context,
) {
  if (!result.success) {
    return c.json({ error: result.error?.issues[0]?.message ?? "入力が正しくありません。" }, 400);
  }
}

export class HttpError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}
