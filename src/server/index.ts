/**
 * Worker の入口。`/api` の下と、Firebase の認証の通り道、招待リンクの OG タグの書き換えだけをここで受ける。
 * ほかの画面のファイルは静的アセットとして配る。
 *
 * 土台の機能は modules/ に、拡張は extensions/ にある。拡張の API は registry.server.ts から読んで載せる。
 */

import { serverExtensions } from "@extensions/server/registry";
import { type AppEnv, HttpError, resolveAppUrl } from "@server/core/app";
import { isFirebaseAuthPath, proxyFirebaseAuth } from "@server/core/auth/firebase-proxy";
import { createDb } from "@server/core/db/client";
import { matchInvitePath, rewriteInviteMeta } from "@server/core/invite-og";
import { cleanupOldNotifications } from "@server/core/notifications/send";
import { calendarRoutes } from "@server/modules/calendar/routes";
import { clientErrorRoutes } from "@server/modules/client-errors/routes";
import { extensionRoutes } from "@server/modules/group-extensions/routes";
import { groupRoutes } from "@server/modules/groups/routes";
import { inviteRoutes } from "@server/modules/invites/routes";
import { meRoutes } from "@server/modules/me/routes";
import { notificationRoutes } from "@server/modules/notifications/routes";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";

const app = new Hono<AppEnv>().basePath("/api");

app.use("*", secureHeaders());
app.use("*", async (c, next) => {
  c.set("db", createDb(c.env.DB));
  c.set("appUrl", resolveAppUrl(c.env, c.req.url));
  await next();
});

app.get("/health", (c) => c.json({ ok: true }));
app.route("/client-errors", clientErrorRoutes);
app.route("/me", meRoutes);
app.route("/groups", groupRoutes);
app.route("/invites", inviteRoutes);
app.route("/calendar", calendarRoutes);
app.route("/extensions", extensionRoutes);
app.route("/notifications", notificationRoutes);
for (const x of serverExtensions) {
  if (x.routes) app.route(x.routes.basePath, x.routes.router);
}

app.notFound((c) => c.json({ error: "見つかりません。" }, 404));
app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message, code: err.code }, err.status);
  console.error(err);
  return c.json({ error: "サーバーで問題が起きました。時間をおいて、もう一度試してください。" }, 500);
});

/**
 * 招待リンクの画面。画面自体は静的アセットのままで、OG タグだけ書き換えて返す。
 * DB は読まない。書き換えないときと同じ HTML を ASSETS から読むだけ。#93
 */
async function serveInvitePage(request: Request, env: Env, token: string): Promise<Response> {
  const assetRes = await env.ASSETS.fetch(request);
  const isHtml = assetRes.headers.get("content-type")?.includes("text/html");
  if (!isHtml || (request.method !== "GET" && request.method !== "HEAD")) return assetRes;
  const html = rewriteInviteMeta(await assetRes.text(), resolveAppUrl(env, request.url), token);
  const headers = new Headers(assetRes.headers);
  headers.delete("content-length");
  return new Response(html, { status: assetRes.status, statusText: assetRes.statusText, headers });
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (isFirebaseAuthPath(pathname)) return proxyFirebaseAuth(request, env.FIREBASE_PROJECT_ID);
    const inviteToken = matchInvitePath(pathname);
    if (inviteToken !== null) return serveInvitePage(request, env, inviteToken);
    return app.fetch(request, env, ctx);
  },
  /** Cron Triggers。wrangler.jsonc の triggers.crons で 5 分おきに呼ぶ。拡張の定期の処理を順に動かす */
  async scheduled(_controller, env, ctx) {
    const db = createDb(env.DB);
    for (const x of serverExtensions) {
      if (x.scheduled) ctx.waitUntil(x.scheduled(db, env));
    }
    // お知らせの掃除は拡張ではなく土台の仕事。90 日を過ぎた行を消す。#32
    ctx.waitUntil(cleanupOldNotifications(db));
  },
} satisfies ExportedHandler<Env>;
