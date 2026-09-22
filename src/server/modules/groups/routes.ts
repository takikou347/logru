import { zValidator } from "@hono/zod-validator";
import { and, eq, isNull, ne } from "drizzle-orm";
import type { ExtensionInfo } from "@shared/api-types";
import { pickUnusedColor } from "@shared/colors";
import { extensionToggleInput, groupInput, groupPatchInput, memberRoleInput } from "@shared/schemas";
import { serverExtensions, toggleableExtensions } from "@extensions/server/registry";
import { HttpError, createRouter, validationHook } from "@server/core/app";
import { requireAgreement, requireUser } from "@server/core/auth/middleware";
import { groupExtensions, groupInvites, groupMembers, groups } from "@server/core/db/schema";
import { listGroups, requireMembership } from "@server/modules/groups/membership";

/** 招待リンクの有効な期間。7 日 */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** 推測できない招待の文字列を作る。24 バイトの乱数を URL で使える Base64 にする */
function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/** `/api/groups`。グループ、招待、管理者の受け渡し、拡張の切り替え */
export const groupRoutes = createRouter()
  .use("*", requireUser, requireAgreement)
  .get("/", async (c) => c.json({ groups: await listGroups(c.get("db"), c.get("user").id) }))
  .post("/", zValidator("json", groupInput, validationHook), async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const { name } = c.req.valid("json");
    const existing = await listGroups(db, me.id);
    const id = crypto.randomUUID();
    await db.batch([
      db.insert(groups).values({ id, name, color: pickUnusedColor(existing.map((g) => g.color)), createdBy: me.id }),
      db.insert(groupMembers).values({ groupId: id, userId: me.id, role: "admin" }),
    ]);
    return c.json((await listGroups(db, me.id)).find((g) => g.id === id), 201);
  })
  .patch("/:id", zValidator("json", groupPatchInput, validationHook), async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");
    const membership = await requireMembership(db, c.get("user").id, id, true);
    const input = c.req.valid("json");
    if (membership.isPersonal && input.name !== undefined) {
      throw new HttpError(400, "自分だけのグループの名前は変えられません。");
    }
    await db
      .update(groups)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(groups.id, id));
    return c.json((await listGroups(db, c.get("user").id)).find((g) => g.id === id));
  })
  .post("/:id/invites", async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");
    const membership = await requireMembership(db, c.get("user").id, id, true);
    if (membership.isPersonal) throw new HttpError(400, "自分だけのグループには招待できません。");
    const token = randomToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    await db.insert(groupInvites).values({ id: crypto.randomUUID(), groupId: id, token, createdBy: c.get("user").id, expiresAt });
    return c.json({ token, url: `${c.get("appUrl")}/invite/${token}`, expiresAt: expiresAt.getTime() }, 201);
  })
  .delete("/:id/invites", async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");
    await requireMembership(db, c.get("user").id, id, true);
    await db
      .update(groupInvites)
      .set({ revokedAt: new Date() })
      .where(and(eq(groupInvites.groupId, id), isNull(groupInvites.revokedAt)));
    return c.body(null, 204);
  })
  .patch("/:id/members/:userId", zValidator("json", memberRoleInput, validationHook), async (c) => {
    const db = c.get("db");
    const groupId = c.req.param("id");
    const targetId = c.req.param("userId");
    const membership = await requireMembership(db, c.get("user").id, groupId, true);
    if (membership.isPersonal) throw new HttpError(400, "自分だけのグループでは変えられません。");
    await requireMembership(db, targetId, groupId);
    const { role } = c.req.valid("json");
    if (role === "member") {
      const admins = await db
        .select({ id: groupMembers.userId })
        .from(groupMembers)
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.role, "admin"), ne(groupMembers.userId, targetId)));
      if (admins.length === 0) throw new HttpError(409, "管理者が 1 人もいなくなります。先にほかの人を管理者にしてください。");
    }
    await db
      .update(groupMembers)
      .set({ role })
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetId)));
    return c.json((await listGroups(db, c.get("user").id)).find((g) => g.id === groupId));
  })
  .delete("/:id/members/me", async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const groupId = c.req.param("id");
    const membership = await requireMembership(db, me.id, groupId);
    if (membership.isPersonal) throw new HttpError(400, "自分だけのグループからは抜けられません。");
    const others = await db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), ne(groupMembers.userId, me.id)));
    if (others.length === 0) {
      // 最後の 1 人が抜けたら、グループごと消す
      await db.delete(groups).where(eq(groups.id, groupId));
      return c.body(null, 204);
    }
    if (membership.role === "admin" && !others.some((o) => o.role === "admin")) {
      throw new HttpError(409, "ほかに管理者がいません。先にほかの人を管理者にしてください。");
    }
    // 拡張に、抜ける人のデータを片付けさせる。予定の拡張は、その人を予定の参加者から外す。#28
    for (const x of serverExtensions) await x.onMemberLeave?.(db, groupId, me.id);
    await db.delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, me.id)));
    return c.body(null, 204);
  })
  .get("/:id/extensions", async (c) => {
    const db = c.get("db");
    const groupId = c.req.param("id");
    await requireMembership(db, c.get("user").id, groupId);
    const rows = await db.select().from(groupExtensions).where(eq(groupExtensions.groupId, groupId));
    const list: ExtensionInfo[] = toggleableExtensions().map(({ manifest }) => ({
      key: manifest.key,
      label: manifest.label,
      description: manifest.description,
      enabled: rows.some((r) => r.extensionKey === manifest.key && r.enabled),
    }));
    return c.json({ extensions: list });
  })
  .put("/:id/extensions/:key", zValidator("json", extensionToggleInput, validationHook), async (c) => {
    const db = c.get("db");
    const groupId = c.req.param("id");
    const key = c.req.param("key");
    await requireMembership(db, c.get("user").id, groupId, true);
    if (!toggleableExtensions().some((x) => x.manifest.key === key)) throw new HttpError(404, "その拡張はありません。");
    const values = { enabled: c.req.valid("json").enabled, updatedBy: c.get("user").id, updatedAt: new Date() };
    // 無効にしても行は消さない。拡張のデータにも触れない。F-11
    await db
      .insert(groupExtensions)
      .values({ groupId, extensionKey: key, ...values })
      .onConflictDoUpdate({ target: [groupExtensions.groupId, groupExtensions.extensionKey], set: values });
    // 共有のグループで有効にした人は、自分でも使うとみなす。使うかどうかは自分だけのグループの切り替えで持つ。0019
    const membership = await requireMembership(db, c.get("user").id, groupId);
    if (values.enabled && !membership.isPersonal) {
      const personal = (await listGroups(db, c.get("user").id)).find((g) => g.isPersonal);
      if (personal) {
        await db
          .insert(groupExtensions)
          .values({ groupId: personal.id, extensionKey: key, ...values })
          .onConflictDoUpdate({ target: [groupExtensions.groupId, groupExtensions.extensionKey], set: values });
      }
    }
    return c.json({ key, enabled: values.enabled });
  });
