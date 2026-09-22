import { type Context, Hono } from "hono";
import type { DB } from "@server/core/db/client";

/** 認証を通った利用者。D1 の users 表の 1 行に当たる */
export type SessionUser = {
  /** Firebase の利用者 ID。D1 でも同じ値を主キーにする */
  id: string;
  name: string;
  email: string;
  image: string | null;
  /** ログインに使った手段。`google.com` か `password` */
  provider: string;
};

/** Hono に載せる型。Bindings は wrangler types が作る Env */
export type AppEnv = {
  Bindings: Env;
  Variables: { db: DB; user: SessionUser; appUrl: string };
};

/** 型付きの Hono のルーターを作る。各 routes.ts はこれで始める */
export const createRouter = () => new Hono<AppEnv>();

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * 手元で開発しているときだけ true を返す。
 *
 * 設定が development でも、localhost 以外からの要求は数えない。
 * 本番の設定を付け忘れて公開しても、署名の無いトークンなどの開発用の振る舞いが外から使えないようにする。
 *
 * @param env Worker の環境変数
 * @param requestUrl 要求の URL
 */
export function isLocalDev(env: Env, requestUrl: string): boolean {
  return env.ENVIRONMENT === "development" && LOCAL_HOSTS.has(new URL(requestUrl).hostname);
}

/**
 * 画面の URL を返す。招待リンクに使う。
 *
 * 本番は APP_URL に固定する。手元では、開発サーバーと本番と同じ形の確認で番号が違うので、
 * 要求が来た出どころを使う。
 */
export function resolveAppUrl(env: Env, requestUrl: string): string {
  if (isLocalDev(env, requestUrl)) return new URL(requestUrl).origin;
  return new URL(env.APP_URL).origin;
}

/**
 * zValidator の失敗を、最初の 1 件の文言で 400 にして返す。
 * @example zValidator("json", groupInput, validationHook)
 */
export function validationHook(
  result: { success: boolean; error?: { issues: readonly { message: string }[] } },
  c: Context,
) {
  if (!result.success) {
    return c.json({ error: result.error?.issues[0]?.message ?? "入力が正しくありません。" }, 400);
  }
}

/** 画面に文言を返す失敗。index.ts の onError が JSON にする */
export class HttpError extends Error {
  /**
   * @param status HTTP の状態
   * @param message 画面にそのまま出す文言
   * @param code 画面が分岐に使う印。省略できる
   */
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}
