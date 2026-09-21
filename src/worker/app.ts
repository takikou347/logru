import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { Auth } from "./auth";
import type { DB } from "./db/client";

export type SessionUser = { id: string; name: string; email: string; emailVerified: boolean; image?: string | null };

export type AppEnv = {
  Bindings: Env;
  Variables: { db: DB; auth: Auth; user: SessionUser };
};

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
    const allowed = new URL(c.env.APP_URL).origin;
    if (origin && origin !== allowed && origin !== new URL(c.req.url).origin) {
      return c.json({ error: "許可されていない出どころです。" }, 403);
    }
  }
  await next();
});

export class HttpError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}
