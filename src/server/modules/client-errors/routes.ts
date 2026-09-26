import { zValidator } from "@hono/zod-validator";
import { createRouter, validationHook } from "@server/core/app";
import { clientIp, enforceRateLimit } from "@server/core/rate-limit";
import { clientErrorInput } from "@shared/schemas";
import { bodyLimit } from "hono/body-limit";

/** 本文の大きさの上限。予定の中身などは送らない約束なので、これだけあれば足りる。0040 */
export const CLIENT_ERROR_BODY_MAX_BYTES = 4 * 1024;

/**
 * `/api/client-errors`。画面で起きた誤りを Workers Logs へ出すだけの入り口。0040
 *
 * ログインの前にも起きるので、ログインは求めない。何も保存せず、探しやすい形で console.error に出すだけにする。
 * `observability` は wrangler.jsonc で有効にしてある。
 *
 * ログインを求めないので、利用者の ID の代わりに IP アドレスを key にした上限を掛ける。
 * 上限が無いと、ログイン無しで何度でも呼べて Workers Logs を埋められる。0065、#161
 */
export const clientErrorRoutes = createRouter().post(
  "/",
  bodyLimit({
    maxSize: CLIENT_ERROR_BODY_MAX_BYTES,
    onError: (c) => c.json({ error: "本文が大きすぎます。" }, 413),
  }),
  zValidator("json", clientErrorInput, validationHook),
  async (c) => {
    await enforceRateLimit(c.env?.CLIENT_ERROR_RATE_LIMIT, clientIp(c));
    const { path, message, stack, buildVersion } = c.req.valid("json");
    console.error(`[client-error] version=${buildVersion} path=${path} message=${message}${stack ? `\n${stack}` : ""}`);
    return c.body(null, 204);
  },
);
