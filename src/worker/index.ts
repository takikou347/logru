import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { type AppEnv, HttpError, sameOrigin } from "./app";
import { createAuth } from "./auth";
import { createDb } from "./db/client";
import { devRoutes } from "./routes/dev";
import { calendarRoutes, eventRoutes } from "./routes/events";
import { groupRoutes } from "./routes/groups";
import { inviteRoutes } from "./routes/invites";
import { meRoutes } from "./routes/me";

const app = new Hono<AppEnv>().basePath("/api");

app.use("*", secureHeaders());
app.use("*", async (c, next) => {
  const db = createDb(c.env.DB);
  c.set("db", db);
  c.set("auth", createAuth(c.env, db));
  await next();
});

app.get("/health", (c) => c.json({ ok: true }));
app.on(["GET", "POST"], "/auth/*", (c) => c.get("auth").handler(c.req.raw));

app.use("*", sameOrigin);
app.route("/dev", devRoutes);
app.route("/me", meRoutes);
app.route("/groups", groupRoutes);
app.route("/invites", inviteRoutes);
app.route("/calendar", calendarRoutes);
app.route("/events", eventRoutes);

app.notFound((c) => c.json({ error: "見つかりません。" }, 404));
app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "サーバーで問題が起きました。時間をおいて、もう一度試してください。" }, 500);
});

export default app;
