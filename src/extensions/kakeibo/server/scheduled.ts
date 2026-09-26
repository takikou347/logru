/**
 * 定期の記録を入れる。決めた日になったら、その月の分を 1 件だけ入れる。0072、F-325
 *
 * 同じ月に 2 回入れないよう、last_month を条件付きの UPDATE ... RETURNING で先に取ってから記録を入れる。
 * ほかの呼び出し(記録を作った直後の即時実行、次の Cron)が先に取っていれば RETURNING が空になり、何もしない。
 *
 * 共有のグループで、共有口座以外(自分の口座か口座なし)から払う定期の記録は、作った人を払った人にし、
 * 全員で同じ額に割る。kota の決定(2026-09-26)。0072
 */

import type { DB } from "@server/core/db/client";
import { groups } from "@server/core/db/schema";
import { and, eq, isNull, ne, or } from "drizzle-orm";
import { dateKeyOfJst } from "../shared/dates";
import { dueDayOfMonth, isRecurringActiveInMonth, monthKeyOfDate } from "../shared/recurring";
import type { KakeiboSplitShare } from "../shared/splits";
import { splitEqually } from "../shared/splits";
import { groupMemberIds } from "./access";
import { type KakeiboRecurringRow, kakeiboAccounts, kakeiboExpenses, kakeiboRecurrings } from "./schema";
import { writeSplits } from "./splits";

/**
 * その定期の記録が、割るべきかどうかと、割るならその中身を決める。0072
 *
 * 共有のグループの支出で、払った口座がそのグループの共有口座でない(自分の口座か口座なし)ときだけ割る。
 * 割り方は常に全員で同じ額。払った人は、この定期の記録を作った人。作った人が退会していれば割らない。
 */
async function resolveRecurringSplit(
  db: DB,
  recurring: KakeiboRecurringRow,
): Promise<{ paidBy: string | null; splitMode: "equal" | null; shares: KakeiboSplitShare[] }> {
  const NONE = { paidBy: null, splitMode: null as "equal" | null, shares: [] as KakeiboSplitShare[] };
  if (recurring.type !== "expense" || !recurring.createdBy) return NONE;

  const groupRow = await db
    .select({ isPersonal: groups.isPersonal })
    .from(groups)
    .where(eq(groups.id, recurring.groupId))
    .get();
  if (!groupRow || groupRow.isPersonal) return NONE;

  const accountGroupId = recurring.accountId
    ? (
        await db
          .select({ groupId: kakeiboAccounts.groupId })
          .from(kakeiboAccounts)
          .where(eq(kakeiboAccounts.id, recurring.accountId))
          .get()
      )?.groupId
    : null;
  const paidFromSharedAccount = accountGroupId === recurring.groupId;
  if (paidFromSharedAccount) return NONE;

  const memberIds = await groupMemberIds(db, recurring.groupId);
  if (!memberIds.includes(recurring.createdBy)) return NONE;
  return {
    paidBy: recurring.createdBy,
    splitMode: "equal",
    shares: splitEqually(recurring.amount, memberIds, recurring.createdBy),
  };
}

/**
 * その定期の記録が、その月の分をまだ入れていなければ、条件付きの UPDATE で先に last_month を取ってから、
 * 記録を 1 件入れる。呼び出しが重なっても(記録を作った直後の即時実行と次の Cron など)、必ず 1 回だけ入る。F-325
 * @param month `2026-09` の形。呼んだ時点の今日を含む月
 * @param today `2026-09-24` の形。呼んだ時点の今日
 */
export async function tryInsertOccurrence(
  db: DB,
  recurring: KakeiboRecurringRow,
  month: string,
  today: string,
): Promise<void> {
  if (!isRecurringActiveInMonth({ ...recurring, pausedAt: recurring.pausedAt?.getTime() ?? null }, month)) return;
  const [y, m] = month.split("-").map(Number) as [number, number];
  const day = dueDayOfMonth(recurring.dayOfMonth, y, m);
  const date = `${month}-${String(day).padStart(2, "0")}`;
  // まだその日になっていない。次の Cron か、次に呼ばれたときにもう一度確かめる
  if (date > today) return;

  // 同じ月に 2 回入れない。すでに last_month がこの月なら、ほかの呼び出しが先に取っている。0072
  const claimed = await db
    .update(kakeiboRecurrings)
    .set({ lastMonth: month, updatedAt: new Date() })
    .where(
      and(
        eq(kakeiboRecurrings.id, recurring.id),
        or(isNull(kakeiboRecurrings.lastMonth), ne(kakeiboRecurrings.lastMonth, month)),
      ),
    )
    .returning({ id: kakeiboRecurrings.id })
    .get();
  if (!claimed) return;

  const { paidBy, splitMode, shares } = await resolveRecurringSplit(db, recurring);

  const id = crypto.randomUUID();
  await db.insert(kakeiboExpenses).values({
    id,
    groupId: recurring.groupId,
    createdBy: recurring.createdBy,
    type: recurring.type,
    date,
    amount: recurring.amount,
    category: recurring.category,
    accountId: recurring.accountId,
    toAccountId: recurring.toAccountId,
    memo: recurring.memo,
    paidBy,
    splitMode,
  });
  if (shares.length > 0) await writeSplits(db, id, shares);
}

/**
 * Cron Triggers から呼ばれる。動いているすべての定期の記録に、今日までの分が要るか確かめて入れる。F-325
 * @param db D1 を包んだ Drizzle
 */
export async function insertDueRecurringRecords(db: DB): Promise<void> {
  const today = dateKeyOfJst(Date.now());
  const month = monthKeyOfDate(today);
  const rows = await db.select().from(kakeiboRecurrings);
  for (const row of rows) {
    await tryInsertOccurrence(db, row, month, today);
  }
}
