import { zValidator } from "@hono/zod-validator";
import { createRouter, HttpError, validationHook } from "@server/core/app";
import { eq } from "drizzle-orm";
import { kakeiboGroupSettingsInput } from "../shared/schemas";
import { requireKakeiboGroup, usableGroups } from "./access";
import { kakeiboAccounts, kakeiboGroupSettings } from "./schema";

/**
 * `/api/kakeibo/group-settings`。グループの「よく使う払い方」の既定を読む、直す。共有のグループだけ持つ。0087、F-329
 *
 * グループに「共有口座型・立て替え型」の切り替えは持たない(0069)。既定はあくまで記録のシートの
 * 口座の初期値に使うだけで、支出ごとの払った所で割るかどうかが決まる仕組みは変えない。
 */
export const kakeiboGroupSettingsRoutes = createRouter()
  .get("/", async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const groupId = c.req.query("group") ?? "";
    await requireKakeiboGroup(db, userId, groupId);
    const usable = (await usableGroups(db, userId, [groupId]))[0]!;
    // 自分だけのグループには、立て替えという考え方が無いので既定を持たない
    if (usable.isPersonal) return c.json({ defaultAccountId: null });
    const row = await db
      .select({ defaultAccountId: kakeiboGroupSettings.defaultAccountId, archivedAt: kakeiboAccounts.archivedAt })
      .from(kakeiboGroupSettings)
      .leftJoin(kakeiboAccounts, eq(kakeiboAccounts.id, kakeiboGroupSettings.defaultAccountId))
      .where(eq(kakeiboGroupSettings.groupId, groupId))
      .get();
    // 既定にしていた口座を後から「使わない」にしていれば、既定は外れたものとして扱う
    return c.json({ defaultAccountId: row && !row.archivedAt ? row.defaultAccountId : null });
  })
  .patch("/", zValidator("json", kakeiboGroupSettingsInput, validationHook), async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const groupId = c.req.query("group") ?? "";
    await requireKakeiboGroup(db, userId, groupId);
    const usable = (await usableGroups(db, userId, [groupId]))[0]!;
    if (usable.isPersonal) throw new HttpError(400, "自分だけのグループには設定がありません。");
    const input = c.req.valid("json");

    let defaultAccountId: string | null = null;
    if (input.defaultAccountId) {
      const account = await db
        .select()
        .from(kakeiboAccounts)
        .where(eq(kakeiboAccounts.id, input.defaultAccountId))
        .get();
      // 既定にできるのは、このグループの使わないにしていない共有口座だけ。自分の口座は選べない
      if (!account || account.groupId !== groupId || account.archivedAt)
        throw new HttpError(400, "その口座は選べません。");
      defaultAccountId = account.id;
    }

    const values = { defaultAccountId, updatedBy: userId, updatedAt: new Date() };
    await db
      .insert(kakeiboGroupSettings)
      .values({ groupId, ...values })
      .onConflictDoUpdate({ target: kakeiboGroupSettings.groupId, set: values });
    return c.json({ defaultAccountId });
  });
