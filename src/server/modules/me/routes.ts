import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray, ne } from "drizzle-orm";
import type { Me, PushInfo } from "@shared/api-types";
import { LEGAL_VERSIONS, type LegalDocument } from "@shared/legal";
import {
  agreementsInput,
  colorPrefInput,
  deleteAccountInput,
  memberVisibilityInput,
  profileInput,
  pushSubscriptionInput,
  settingsInput,
} from "@shared/schemas";
import { HttpError, createRouter, validationHook } from "@server/core/app";
import { missingAgreements, requireAgreement, requireUser } from "@server/core/auth/middleware";
import type { DB } from "@server/core/db/client";
import { colorPrefs, groupMembers, groups, legalAgreements, memberVisibility, pushSubscriptions, userSettings, users } from "@server/core/db/schema";
import { vapidKeys } from "@server/core/push/send";
import { myGroupIds, sharesGroup } from "@server/modules/groups/membership";

/**
 * 退会したときに消すグループと、退会を止めるグループを調べる。
 *
 * 自分だけのグループと、自分しか残っていないグループは消す。
 * ほかにメンバーがいて、ほかに管理者がいないグループがあれば、退会を止める。F-17
 *
 * @param db D1 を包んだ Drizzle
 * @param userId 退会する人の ID
 */
async function planDeletion(db: DB, userId: string) {
  const mine = await db
    .select({ groupId: groupMembers.groupId, role: groupMembers.role, isPersonal: groups.isPersonal, name: groups.name })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, userId));
  const toDelete: string[] = [];
  const blocked: string[] = [];
  for (const g of mine) {
    if (g.isPersonal) {
      toDelete.push(g.groupId);
      continue;
    }
    const others = await db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, g.groupId), ne(groupMembers.userId, userId)));
    if (others.length === 0) toDelete.push(g.groupId);
    else if (g.role === "admin" && !others.some((o) => o.role === "admin")) blocked.push(g.name);
  }
  return { toDelete, blocked };
}

/** 退会を止めるときの文言 */
function blockedMessage(blocked: string[]): string {
  return `ほかに管理者がいないグループがあります。先に管理者を渡してください: ${blocked.join("、")}`;
}

/** `/api/me`。自分の情報、設定、色、同意、退会 */
export const meRoutes = createRouter()
  .use("*", requireUser)
  .get("/", async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const settings =
      (await db.select().from(userSettings).where(eq(userSettings.userId, me.id)).get()) ??
      (await db.insert(userSettings).values({ userId: me.id }).returning().get());
    const prefs = await db.select().from(colorPrefs).where(eq(colorPrefs.userId, me.id));
    const hidden = await db
      .select({ id: memberVisibility.targetUserId })
      .from(memberVisibility)
      .where(and(eq(memberVisibility.userId, me.id), eq(memberVisibility.hidden, true)));
    const body: Me = {
      user: { id: me.id, name: me.name, email: me.email, image: me.image },
      settings: { themeMode: settings.themeMode, accentColor: settings.accentColor, userColor: settings.userColor },
      needsAgreement: await missingAgreements(db, me.id),
      provider: me.provider,
      colorPrefs: prefs.map((p) => ({ targetType: p.targetType, targetId: p.targetId, color: p.color })),
      hiddenMembers: hidden.map((h) => h.id),
    };
    return c.json(body);
  })
  .post("/agreements", zValidator("json", agreementsInput, validationHook), async (c) => {
    const userId = c.get("user").id;
    const rows = (Object.entries(LEGAL_VERSIONS) as [LegalDocument, string][]).map(([document, version]) => ({
      userId,
      document,
      version,
    }));
    await c.get("db").insert(legalAgreements).values(rows).onConflictDoNothing();
    return c.body(null, 204);
  })
  .get("/deletion", async (c) => {
    // 退会の前に、止める理由が無いかだけを確かめる。画面は Firebase のアカウントを消す前にこれを呼ぶ
    const { blocked } = await planDeletion(c.get("db"), c.get("user").id);
    return c.json({ ok: blocked.length === 0, blocked, message: blocked.length ? blockedMessage(blocked) : null });
  })
  .delete("/", zValidator("json", deleteAccountInput, validationHook), async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const { toDelete, blocked } = await planDeletion(db, me.id);
    if (blocked.length) throw new HttpError(409, blockedMessage(blocked), "ADMIN_REQUIRED");
    await db.batch([
      ...(toDelete.length
        ? [
            db.delete(groups).where(inArray(groups.id, toDelete)),
            db.delete(colorPrefs).where(and(eq(colorPrefs.targetType, "group"), inArray(colorPrefs.targetId, toDelete))),
          ]
        : []),
      db.delete(colorPrefs).where(and(eq(colorPrefs.targetType, "user"), eq(colorPrefs.targetId, me.id))),
      // 共有グループに残る予定などは、外部キーで作った人が空になる
      db.delete(users).where(eq(users.id, me.id)),
    ] as unknown as Parameters<typeof db.batch>[0]);
    return c.body(null, 204);
  })
  // ここから下は、最新の規約に同意している人だけ
  .use("*", requireAgreement)
  .patch("/", zValidator("json", profileInput, validationHook), async (c) => {
    const { name } = c.req.valid("json");
    await c.get("db").update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, c.get("user").id));
    return c.json({ name });
  })
  .put("/settings", zValidator("json", settingsInput, validationHook), async (c) => {
    const values = { ...c.req.valid("json"), updatedAt: new Date() };
    const row = await c
      .get("db")
      .insert(userSettings)
      .values({ userId: c.get("user").id, ...values })
      .onConflictDoUpdate({ target: userSettings.userId, set: values })
      .returning()
      .get();
    return c.json({ themeMode: row.themeMode, accentColor: row.accentColor, userColor: row.userColor });
  })
  .put("/colors/:type/:id", zValidator("json", colorPrefInput, validationHook), async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const targetType = c.req.param("type");
    const targetId = c.req.param("id");
    if (targetType !== "group" && targetType !== "user") throw new HttpError(404, "見つかりません。");
    const groupIds = await myGroupIds(db, me.id);
    // 自分が入っているグループか、同じグループのメンバーだけ色を変えられる
    const visible =
      targetType === "group"
        ? groupIds.includes(targetId)
        : groupIds.length > 0 &&
          (await db
            .select({ id: groupMembers.userId })
            .from(groupMembers)
            .where(and(inArray(groupMembers.groupId, groupIds), eq(groupMembers.userId, targetId)))
            .get()) !== undefined;
    if (!visible) throw new HttpError(404, "見つかりません。");
    const values = { color: c.req.valid("json").color, updatedAt: new Date() };
    await db
      .insert(colorPrefs)
      .values({ userId: me.id, targetType, targetId, ...values })
      .onConflictDoUpdate({ target: [colorPrefs.userId, colorPrefs.targetType, colorPrefs.targetId], set: values });
    return c.json({ targetType, targetId, color: values.color });
  })
  .put("/visibility/:userId", zValidator("json", memberVisibilityInput, validationHook), async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const targetUserId = c.req.param("userId");
    // 自分と、同じグループのメンバーだけ選べる。F-20
    if (!(await sharesGroup(db, me.id, targetUserId))) throw new HttpError(404, "見つかりません。");
    const values = { hidden: c.req.valid("json").hidden, updatedAt: new Date() };
    await db
      .insert(memberVisibility)
      .values({ userId: me.id, targetUserId, ...values })
      .onConflictDoUpdate({ target: [memberVisibility.userId, memberVisibility.targetUserId], set: values });
    return c.json({ userId: targetUserId, hidden: values.hidden });
  })
  .delete("/colors/:type/:id", async (c) => {
    const type = c.req.param("type");
    if (type !== "group" && type !== "user") throw new HttpError(404, "見つかりません。");
    await c
      .get("db")
      .delete(colorPrefs)
      .where(and(eq(colorPrefs.userId, c.get("user").id), eq(colorPrefs.targetType, type), eq(colorPrefs.targetId, c.req.param("id"))));
    return c.body(null, 204);
  })
  // 端末への知らせの送り先。F-23、0023
  .get("/push", async (c) => {
    const rows = await c.get("db").select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, c.get("user").id));
    const body: PushInfo = {
      publicKey: vapidKeys(c.env)?.publicKey ?? null,
      devices: rows.map((r) => ({ id: r.id, endpoint: r.endpoint, userAgent: r.userAgent, createdAt: r.createdAt.getTime() })),
    };
    return c.json(body);
  })
  .post("/push", zValidator("json", pushSubscriptionInput, validationHook), async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const input = c.req.valid("json");
    const mine = await db.select({ id: pushSubscriptions.id, endpoint: pushSubscriptions.endpoint }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, me.id));
    if (mine.length >= MAX_DEVICES && !mine.some((m) => m.endpoint === input.endpoint)) {
      throw new HttpError(409, `知らせを受ける端末は ${MAX_DEVICES} 台までです。使わない端末を外してください。`);
    }
    // 同じ送り先なら置き換える。別の人が同じ端末で登録し直したときも、今の人のものにする
    const values = { userId: me.id, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent: input.userAgent ?? null, failedCount: 0 };
    const row = await db
      .insert(pushSubscriptions)
      .values({ id: crypto.randomUUID(), endpoint: input.endpoint, ...values })
      .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values })
      .returning()
      .get();
    return c.json({ id: row.id }, 201);
  })
  .delete("/push/:id", async (c) => {
    await c
      .get("db")
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.id, c.req.param("id")), eq(pushSubscriptions.userId, c.get("user").id)));
    return c.body(null, 204);
  });

/** 知らせを受ける端末の上限。0023 */
const MAX_DEVICES = 10;
