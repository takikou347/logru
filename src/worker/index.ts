import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>().basePath("/api");

app.get("/health", (c) => c.json({ ok: true, env: c.env.ENVIRONMENT }));

export default app;
