import { eq } from "drizzle-orm";
import type { InviteInfo } from "../../shared/api-types";
import { HttpError, createRouter, requireUser } from "../app";
import { groupInvites, groupMembers, groups } from "../db/schema";

async function findInvite(c: { get: (k: "db") => import("../db/client").DB }, token: string) {
  const row = await c
    .get("db")
    .select({ invite: groupInvites, groupName: groups.name })
    .from(groupInvites)
    .innerJoin(groups, eq(groups.id, groupInvites.groupId))
    .where(eq(groupInvites.token, token))
    .get();
  if (!row) throw new HttpError(404, "招待リンクが見つかりません。リンクを送った人に、新しいリンクを頼んでください。");
  const reason = row.invite.revokedAt ? "revoked" : row.invite.expiresAt.getTime() < Date.now() ? "expired" : undefined;
  return { ...row, reason } as const;
}

export const inviteRoutes = createRouter()
  .get("/:token", async (c) => {
    const { invite, groupName, reason } = await findInvite(c, c.req.param("token"));
    const body: InviteInfo = { groupName, expiresAt: invite.expiresAt.getTime(), valid: !reason, reason };
    return c.json(body);
  })
  .post("/:token/accept", requireUser, async (c) => {
    const { invite, reason } = await findInvite(c, c.req.param("token"));
    if (reason === "expired") throw new HttpError(400, "招待リンクの期限が切れています。新しいリンクを頼んでください。");
    if (reason === "revoked") throw new HttpError(400, "この招待リンクは取り消されています。新しいリンクを頼んでください。");
    await c
      .get("db")
      .insert(groupMembers)
      .values({ groupId: invite.groupId, userId: c.get("user").id, role: "member" })
      .onConflictDoNothing();
    return c.json({ groupId: invite.groupId });
  });
