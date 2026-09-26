/**
 * 精算の計算に要る、DB からの読み出し。計算そのものは shared/settlement.ts の純粋な関数に任せる。0072、F-320〜F-322
 */
import type { DB } from "@server/core/db/client";
import { and, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { minimalTransfers, netBalances, type Transfer } from "../shared/settlement";
import { kakeiboExpenses, kakeiboSettlements, kakeiboSplits } from "./schema";

/** 1 つのグループの精算の中身 */
export type GroupSettlement = {
  balances: { userId: string; paid: number; owed: number; net: number }[];
  transfers: Transfer[];
};

/**
 * 1 つのグループの、人ごとの払った額・負担額・差し引きと、送る組み合わせを計算する。
 * 払った額・負担額は割った記録の全期間の合計(精算で減らない)。差し引きは精算した記録の分を反映する。0072
 */
export async function computeGroupSettlement(db: DB, groupId: string): Promise<GroupSettlement> {
  const paidRows = await db
    .select({ userId: kakeiboExpenses.paidBy, amount: kakeiboExpenses.amount })
    .from(kakeiboExpenses)
    .where(and(eq(kakeiboExpenses.groupId, groupId), isNotNull(kakeiboExpenses.splitMode)));
  const owedRows = await db
    .select({ userId: kakeiboSplits.userId, amount: kakeiboSplits.amount })
    .from(kakeiboSplits)
    .innerJoin(kakeiboExpenses, eq(kakeiboExpenses.id, kakeiboSplits.expenseId))
    .where(eq(kakeiboExpenses.groupId, groupId));
  const settlementRows = await db
    .select({ from: kakeiboSettlements.fromUser, to: kakeiboSettlements.toUser, amount: kakeiboSettlements.amount })
    .from(kakeiboSettlements)
    .where(eq(kakeiboSettlements.groupId, groupId));

  const paid = paidRows.filter((r): r is { userId: string; amount: number } => r.userId !== null);
  const owed = owedRows.filter((r): r is { userId: string; amount: number } => r.userId !== null);
  const settlements = settlementRows.filter(
    (r): r is { from: string; to: string; amount: number } => r.from !== null && r.to !== null,
  );

  const rawTotals = new Map<string, { paid: number; owed: number }>();
  const bump = (userId: string, delta: { paid?: number; owed?: number }) => {
    const cur = rawTotals.get(userId) ?? { paid: 0, owed: 0 };
    rawTotals.set(userId, { paid: cur.paid + (delta.paid ?? 0), owed: cur.owed + (delta.owed ?? 0) });
  };
  for (const p of paid) bump(p.userId, { paid: p.amount });
  for (const o of owed) bump(o.userId, { owed: o.amount });

  const net = netBalances(
    paid,
    owed,
    settlements.map((s) => ({ from: s.from, to: s.to, amount: s.amount })),
  );
  const balances = [...rawTotals.entries()].map(([userId, t]) => ({
    userId,
    paid: t.paid,
    owed: t.owed,
    net: net.get(userId) ?? 0,
  }));
  return { balances, transfers: minimalTransfers(net) };
}

/**
 * その月に、共有のグループで負担した額の合計。自分だけの画面に出す。0072、F-322
 * @param from `2026-09-01` の形。月の始まり
 * @param to `2026-10-01` の形。月の終わり(含まない)
 */
export async function sharedBurdenThisMonth(db: DB, userId: string, from: string, to: string): Promise<number> {
  const rows = await db
    .select({ amount: kakeiboSplits.amount })
    .from(kakeiboSplits)
    .innerJoin(kakeiboExpenses, eq(kakeiboExpenses.id, kakeiboSplits.expenseId))
    .where(
      and(
        eq(kakeiboSplits.userId, userId),
        gte(kakeiboExpenses.date, from),
        lt(kakeiboExpenses.date, to),
        isNotNull(kakeiboExpenses.splitMode),
      ),
    );
  return rows.reduce((n, r) => n + r.amount, 0);
}

/**
 * いま立て替え中の額を、共有のグループごとに出す。自分だけの画面に出す。0072、F-322
 * 貸し借りが無いグループは含めない。
 *
 * 自分の差し引きだけが要るので、グループごとに全期間を読んで送る組み合わせまで計算する
 * computeGroupSettlement は使わない。4 本の GROUP BY で、グループと人ごとの合計だけを読む。#199
 * @param groupIds 利用者が家計簿に使える、全部のグループ。呼び出し側で 1 回だけ読んで渡す。#199
 */
export async function myShareDebts(
  db: DB,
  userId: string,
  groupIds: string[],
): Promise<{ groupId: string; receivable: number; payable: number }[]> {
  if (groupIds.length === 0) return [];
  // 自分だけのグループは割り勘が起きないので、割った記録があるグループだけに絞ってから計算する
  const splitGroupRows = await db
    .select({ groupId: kakeiboExpenses.groupId })
    .from(kakeiboExpenses)
    .where(and(inArray(kakeiboExpenses.groupId, groupIds), isNotNull(kakeiboExpenses.splitMode)));
  const sharedGroupIds = [...new Set(splitGroupRows.map((r) => r.groupId))];
  if (sharedGroupIds.length === 0) return [];

  // グループと人ごとの差し引き。key は `groupId\u0000userId`
  const net = new Map<string, number>();
  const add = (groupId: string, uid: string | null, delta: number) => {
    if (!uid) return;
    const key = `${groupId}\u0000${uid}`;
    net.set(key, (net.get(key) ?? 0) + delta);
  };
  const sum = sql<number>`coalesce(sum(${kakeiboExpenses.amount}), 0)`;
  const settlementSum = sql<number>`coalesce(sum(${kakeiboSettlements.amount}), 0)`;

  const paidRows = await db
    .select({ groupId: kakeiboExpenses.groupId, userId: kakeiboExpenses.paidBy, amount: sum })
    .from(kakeiboExpenses)
    .where(and(inArray(kakeiboExpenses.groupId, sharedGroupIds), isNotNull(kakeiboExpenses.splitMode)))
    .groupBy(kakeiboExpenses.groupId, kakeiboExpenses.paidBy);
  for (const r of paidRows) add(r.groupId, r.userId, r.amount);

  const owedSum = sql<number>`coalesce(sum(${kakeiboSplits.amount}), 0)`;
  const owedRows = await db
    .select({ groupId: kakeiboExpenses.groupId, userId: kakeiboSplits.userId, amount: owedSum })
    .from(kakeiboSplits)
    .innerJoin(kakeiboExpenses, eq(kakeiboExpenses.id, kakeiboSplits.expenseId))
    .where(inArray(kakeiboExpenses.groupId, sharedGroupIds))
    .groupBy(kakeiboExpenses.groupId, kakeiboSplits.userId);
  for (const r of owedRows) add(r.groupId, r.userId, -r.amount);

  // 精算(from が to に送った)は、from の差し引きを増やし(借りを返した)、to の差し引きを減らす(受け取った)
  const sentRows = await db
    .select({ groupId: kakeiboSettlements.groupId, userId: kakeiboSettlements.fromUser, amount: settlementSum })
    .from(kakeiboSettlements)
    .where(inArray(kakeiboSettlements.groupId, sharedGroupIds))
    .groupBy(kakeiboSettlements.groupId, kakeiboSettlements.fromUser);
  for (const r of sentRows) add(r.groupId, r.userId, r.amount);

  const receivedRows = await db
    .select({ groupId: kakeiboSettlements.groupId, userId: kakeiboSettlements.toUser, amount: settlementSum })
    .from(kakeiboSettlements)
    .where(inArray(kakeiboSettlements.groupId, sharedGroupIds))
    .groupBy(kakeiboSettlements.groupId, kakeiboSettlements.toUser);
  for (const r of receivedRows) add(r.groupId, r.userId, -r.amount);

  const results: { groupId: string; receivable: number; payable: number }[] = [];
  for (const groupId of sharedGroupIds) {
    const value = net.get(`${groupId}\u0000${userId}`) ?? 0;
    if (value === 0) continue;
    results.push({ groupId, receivable: value > 0 ? value : 0, payable: value < 0 ? -value : 0 });
  }
  return results;
}
