/**
 * 精算の計算に要る、DB からの読み出し。計算そのものは shared/settlement.ts の純粋な関数に任せる。0072、F-320〜F-322
 */
import type { DB } from "@server/core/db/client";
import { and, eq, gte, inArray, isNotNull, lt } from "drizzle-orm";
import { minimalTransfers, netBalances, type Transfer } from "../shared/settlement";
import { usableGroupIds } from "./access";
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
 * 貸し借りが無いグループは含めない
 */
export async function myShareDebts(
  db: DB,
  userId: string,
): Promise<{ groupId: string; receivable: number; payable: number }[]> {
  const groupIds = (await usableGroupIds(db, userId)).filter(Boolean);
  if (groupIds.length === 0) return [];
  // 自分だけのグループは割り勘が起きないので、割った記録があるグループだけに絞ってから計算する
  const splitGroupRows = await db
    .select({ groupId: kakeiboExpenses.groupId })
    .from(kakeiboExpenses)
    .where(and(inArray(kakeiboExpenses.groupId, groupIds), isNotNull(kakeiboExpenses.splitMode)));
  const sharedGroupIds = [...new Set(splitGroupRows.map((r) => r.groupId))];
  const results: { groupId: string; receivable: number; payable: number }[] = [];
  for (const groupId of sharedGroupIds) {
    const { balances } = await computeGroupSettlement(db, groupId);
    const mine = balances.find((b) => b.userId === userId);
    if (!mine || mine.net === 0) continue;
    results.push({ groupId, receivable: mine.net > 0 ? mine.net : 0, payable: mine.net < 0 ? -mine.net : 0 });
  }
  return results;
}
