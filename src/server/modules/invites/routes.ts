import { createRouter, HttpError } from "@server/core/app";
import { requireAgreement, requireUser } from "@server/core/auth/middleware";
import type { DB } from "@server/core/db/client";
import { groupInvites, groupMembers, groups } from "@server/core/db/schema";
import { notify } from "@server/core/notifications/send";
import { memberIdsOf } from "@server/modules/groups/membership";
import type { InviteInfo } from "@shared/api-types";
import { eq } from "drizzle-orm";

/**
 * 招待リンクを探し、使えない理由があれば添えて返す。
 * @param db D1 を包んだ Drizzle
 * @param token 招待リンクの文字列
 */
async function findInvite(db: DB, token: string) {
  const row = await db
    .select({ invite: groupInvites, groupName: groups.name })
    .from(groupInvites)
    .innerJoin(groups, eq(groups.id, groupInvites.groupId))
    .where(eq(groupInvites.token, token))
    .get();
  if (!row) throw new HttpError(404, "招待リンクが見つかりません。リンクを送った人に、新しいリンクを頼んでください。");
  const reason = row.invite.revokedAt ? "revoked" : row.invite.expiresAt.getTime() < Date.now() ? "expired" : undefined;
  return { ...row, reason } as const;
}

/** `/api/invites`。招待リンクを見るのはログイン無しでできる。参加はログインと同意が要る */
export const inviteRoutes = createRouter()
  .get("/:token", async (c) => {
    const { invite, groupName, reason } = await findInvite(c.get("db"), c.req.param("token"));
    const body: InviteInfo = { groupName, expiresAt: invite.expiresAt.getTime(), valid: !reason, reason };
    return c.json(body);
  })
  .post("/:token/accept", requireUser, requireAgreement, async (c) => {
    const db = c.get("db");
    const me = c.get("user");
    const { invite, groupName, reason } = await findInvite(db, c.req.param("token"));
    if (reason === "expired")
      throw new HttpError(400, "招待リンクの期限が切れています。新しいリンクを頼んでください。");
    if (reason === "revoked")
      throw new HttpError(400, "この招待リンクは取り消されています。新しいリンクを頼んでください。");
    // 先に前からいるメンバーを読んでおく。自分は後で入るので、まだ含まれない
    const existingMemberIds = await memberIdsOf(db, invite.groupId);
    await db
      .insert(groupMembers)
      .values({ groupId: invite.groupId, userId: me.id, role: "member" })
      .onConflictDoNothing();
    // グループに入ったことを、前からいるメンバーに積む。0096、issue #245
    await notify({
      db,
      env: c.env,
      userIds: existingMemberIds,
      actorId: me.id,
      kind: "groups.member_joined",
      payload: { groupName, byUserName: me.name },
    });
    return c.json({ groupId: invite.groupId });
  });
