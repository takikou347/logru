/**
 * Worker の入口。`/api` の下だけをここで受ける。画面のファイルは静的アセットとして配る。
 *
 * 土台の機能は modules/ に、拡張は extensions/ にある。拡張の API は registry.server.ts から読んで載せる。
 */

import { serverExtensions } from "@extensions/server/registry";
import { type AppEnv, HttpError, resolveAppUrl } from "@server/core/app";
import { createDb } from "@server/core/db/client";
import { cleanupOldNotifications } from "@server/core/notifications/send";
import { calendarRoutes } from "@server/modules/calendar/routes";
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

export default {
  fetch: app.fetch,
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
