/**
 * Worker の入口。`/api` の下だけをここで受ける。画面のファイルは静的アセットとして配る。
 *
 * 土台の機能は modules/ に、拡張は extensions/ にある。拡張の API は registry.server.ts から読んで載せる。
 */
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { serverExtensions } from "../extensions/registry.server";
import { type AppEnv, HttpError, resolveAppUrl } from "./core/app";
import { createDb } from "./core/db/client";
import { calendarRoutes } from "./modules/calendar/routes";
import { extensionRoutes } from "./modules/extensions/routes";
import { groupRoutes } from "./modules/groups/routes";
import { inviteRoutes } from "./modules/invites/routes";
import { meRoutes } from "./modules/me/routes";

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
for (const x of serverExtensions) {
  if (x.routes) app.route(x.routes.basePath, x.routes.router as never);
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
      if (x.scheduled) ctx.waitUntil(x.scheduled(db as never, env as never));
    }
  },
} satisfies ExportedHandler<Env>;
