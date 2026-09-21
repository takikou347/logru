import { desc, eq } from "drizzle-orm";
import { createRouter, isLocalDev } from "../app";
import { devMails } from "../db/schema";

/** 開発のときだけ開く。送ったはずのメールを読む */
export const devRoutes = createRouter()
  .use("*", async (c, next) => {
    if (!isLocalDev(c.env, c.req.url)) return c.json({ error: "見つかりません。" }, 404);
    await next();
  })
  .get("/mails", async (c) => {
    const to = c.req.query("to");
    const db = c.get("db");
    const rows = await db
      .select()
      .from(devMails)
      .where(to ? eq(devMails.to, to.toLowerCase()) : undefined)
      .orderBy(desc(devMails.id))
      .limit(20);
    return c.json({ mails: rows });
  });
