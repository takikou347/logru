import { zValidator } from "@hono/zod-validator";
import { createRouter, HttpError, validationHook } from "@server/core/app";
import type { DB } from "@server/core/db/client";
import { desc, eq } from "drizzle-orm";
import { kakeiboSettlementInput } from "../shared/schemas";
import { groupMemberIds, requireKakeiboGroup, usableGroupIds, usableGroups } from "./access";
import { toSettlementDtos } from "./dto";
import { type KakeiboAccountRow, kakeiboAccounts, kakeiboSettlements } from "./schema";
import { computeGroupSettlement } from "./settlement-summary";

/**
 * 口座が、書いた人自身の自分の口座かを確かめる。精算の口座は、それぞれ自分の口座だけ選べる。0072、F-321
 * @param db D1 を包んだ Drizzle
 * @param userId 書いている人
 * @param id 口座の ID
 */
async function loadOwnPersonalAccount(db: DB, userId: string, id: string): Promise<KakeiboAccountRow> {
  const row = await db.select().from(kakeiboAccounts).where(eq(kakeiboAccounts.id, id)).get();
  if (!row) throw new HttpError(404, "見つかりません。");
  const usable = await usableGroups(db, userId, [row.groupId]);
  if (usable.length === 0 || !usable[0]!.isPersonal) throw new HttpError(400, "自分の口座だけ選べます。");
  return row;
}

/** `/api/kakeibo/settlement`(単数)。グループの精算を見る。F-320 */
export const kakeiboSettlementRoutes = createRouter().get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("user").id;
  const groupId = c.req.query("group");
  if (!groupId) throw new HttpError(400, "グループを指定してください。");
  await requireKakeiboGroup(db, userId, groupId);

  const { balances, transfers } = await computeGroupSettlement(db, groupId);
  const settlementRows = await db
    .select()
    .from(kakeiboSettlements)
    .where(eq(kakeiboSettlements.groupId, groupId))
    .orderBy(desc(kakeiboSettlements.date), desc(kakeiboSettlements.id));
  const visibleGroupIds = new Set(await usableGroupIds(db, userId));
  return c.json({ balances, transfers, settlements: await toSettlementDtos(db, settlementRows, visibleGroupIds) });
});

/** `/api/kakeibo/settlements`(複数)。精算したと記録する、消す。F-321 */
export const kakeiboSettlementsRoutes = createRouter()
  .post("/", zValidator("json", kakeiboSettlementInput, validationHook), async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const input = c.req.valid("json");
    await requireKakeiboGroup(db, userId, input.groupId);
    const memberIds = await groupMemberIds(db, input.groupId);
    if (!memberIds.includes(input.fromUser) || !memberIds.includes(input.toUser)) {
      throw new HttpError(400, "送った人と受け取った人は、このグループのメンバーにしてください。");
    }

    let fromAccountId: string | null = null;
    if (input.fromAccountId) {
      if (input.fromUser !== userId) throw new HttpError(400, "自分の口座だけ選べます。");
      fromAccountId = (await loadOwnPersonalAccount(db, userId, input.fromAccountId)).id;
    }
    let toAccountId: string | null = null;
    if (input.toAccountId) {
      if (input.toUser !== userId) throw new HttpError(400, "自分の口座だけ選べます。");
      toAccountId = (await loadOwnPersonalAccount(db, userId, input.toAccountId)).id;
    }

    const id = crypto.randomUUID();
    await db.insert(kakeiboSettlements).values({
      id,
      groupId: input.groupId,
      createdBy: userId,
      fromUser: input.fromUser,
      toUser: input.toUser,
      amount: input.amount,
      date: input.date,
      fromAccountId,
      toAccountId,
    });
    const row = await db.select().from(kakeiboSettlements).where(eq(kakeiboSettlements.id, id)).get();
    const visibleGroupIds = new Set(await usableGroupIds(db, userId));
    return c.json((await toSettlementDtos(db, [row!], visibleGroupIds))[0], 201);
  })
  .delete("/:id", async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const row = await db
      .select()
      .from(kakeiboSettlements)
      .where(eq(kakeiboSettlements.id, c.req.param("id")))
      .get();
    if (!row) throw new HttpError(404, "見つかりません。");
    await requireKakeiboGroup(db, userId, row.groupId);
    if (row.createdBy !== userId) throw new HttpError(403, "消せるのは、作った人だけです。");
    await db.delete(kakeiboSettlements).where(eq(kakeiboSettlements.id, row.id));
    return c.body(null, 204);
  });
