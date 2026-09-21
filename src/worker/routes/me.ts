import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray, ne } from "drizzle-orm";
import type { Me } from "../../shared/api-types";
import { LEGAL_VERSIONS, type LegalDocument } from "../../shared/legal";
import {
  agreementsInput,
  colorPrefInput,
  deleteAccountInput,
  profileInput,
  settingsInput,
} from "../../shared/schemas";
import { HttpError, createRouter, requireUser, validationHook } from "../app";
import { googleEnabled } from "../auth";
import { account, colorPrefs, groupMembers, groups, legalAgreements, user, userSettings } from "../db/schema";
import { myGroupIds } from "../services/membership";


export const meRoutes = createRouter()
  .use("*", requireUser)
  .get("/", async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const settings =
      (await db.select().from(userSettings).where(eq(userSettings.userId, me.id)).get()) ??
      (await db.insert(userSettings).values({ userId: me.id }).returning().get());
    const agreed = await db.select().from(legalAgreements).where(eq(legalAgreements.userId, me.id));
    const needsAgreement = (Object.keys(LEGAL_VERSIONS) as LegalDocument[]).filter(
      (doc) => !agreed.some((a) => a.document === doc && a.version === LEGAL_VERSIONS[doc]),
    );
    const accounts = await db.select({ providerId: account.providerId }).from(account).where(eq(account.userId, me.id));
    const prefs = await db.select().from(colorPrefs).where(eq(colorPrefs.userId, me.id));
    const body: Me = {
      user: { id: me.id, name: me.name, email: me.email, image: me.image ?? null },
      settings: {
        themeMode: settings.themeMode,
        accentColor: settings.accentColor,
        userColor: settings.userColor,
      },
      needsAgreement,
      loginMethods: accounts.map((a) => a.providerId).filter((p) => p === "credential" || p === "google"),
      colorPrefs: prefs.map((p) => ({ targetType: p.targetType, targetId: p.targetId, color: p.color })),
      googleEnabled: googleEnabled(c.env),
    };
    return c.json(body);
  })
  .patch("/", zValidator("json", profileInput, validationHook), async (c) => {
    const { name } = c.req.valid("json");
    await c.get("db").update(user).set({ name, updatedAt: new Date() }).where(eq(user.id, c.get("user").id));
    return c.json({ name });
  })
  .put("/settings", zValidator("json", settingsInput, validationHook), async (c) => {
    const input = c.req.valid("json");
    const values = { ...input, updatedAt: new Date() };
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
    const { color } = c.req.valid("json");
    const values = { color, updatedAt: new Date() };
    await db
      .insert(colorPrefs)
      .values({ userId: me.id, targetType, targetId, ...values })
      .onConflictDoUpdate({ target: [colorPrefs.userId, colorPrefs.targetType, colorPrefs.targetId], set: values });
    return c.json({ targetType, targetId, color });
  })
  .delete("/colors/:type/:id", async (c) => {
    const type = c.req.param("type");
    if (type !== "group" && type !== "user") throw new HttpError(404, "見つかりません。");
    await c
      .get("db")
      .delete(colorPrefs)
      .where(
        and(
          eq(colorPrefs.userId, c.get("user").id),
          eq(colorPrefs.targetType, type),
          eq(colorPrefs.targetId, c.req.param("id")),
        ),
      );
    return c.body(null, 204);
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
  .delete("/", zValidator("json", deleteAccountInput, validationHook), async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const mine = await db
      .select({ groupId: groupMembers.groupId, role: groupMembers.role, isPersonal: groups.isPersonal, name: groups.name })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(eq(groupMembers.userId, me.id));

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
        .where(and(eq(groupMembers.groupId, g.groupId), ne(groupMembers.userId, me.id)));
      if (others.length === 0) toDelete.push(g.groupId);
      else if (g.role === "admin" && !others.some((o) => o.role === "admin")) blocked.push(g.name);
    }
    if (blocked.length) {
      return c.json(
        { error: `ほかに管理者がいないグループがあります。先に管理者を渡してください: ${blocked.join("、")}`, groups: blocked },
        409,
      );
    }
    await db.batch([
      ...(toDelete.length
        ? [
            db.delete(groups).where(inArray(groups.id, toDelete)),
            db.delete(colorPrefs).where(and(eq(colorPrefs.targetType, "group"), inArray(colorPrefs.targetId, toDelete))),
          ]
        : []),
      db.delete(colorPrefs).where(and(eq(colorPrefs.targetType, "user"), eq(colorPrefs.targetId, me.id))),
      db.delete(user).where(eq(user.id, me.id)),
    ] as unknown as Parameters<typeof db.batch>[0]);
    return c.body(null, 204);
  });
