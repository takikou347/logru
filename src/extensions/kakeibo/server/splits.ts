/**
 * 立て替えの負担額を決めて、記録に書き込む。0072、F-318、F-319
 *
 * 割るかどうかは、記録の種類と、払った口座で決まる。共有のグループの支出で、共有口座で払っていない
 * (自分の口座か、口座なし)ときだけ割る。それ以外は payer も割り方も持たない。
 */
import { HttpError } from "@server/core/app";
import type { DB } from "@server/core/db/client";
import { eq } from "drizzle-orm";
import {
  type KakeiboSplitMode,
  type KakeiboSplitShare,
  splitEqually,
  splitNone,
  sumSplitShares,
} from "../shared/splits";
import { groupMemberIds } from "./access";
import { kakeiboSplits } from "./schema";

/** 立て替えの計算の結果 */
export type SplitPlan = { paidBy: string | null; splitMode: KakeiboSplitMode | null; shares: KakeiboSplitShare[] };

/** 割らない結果。共有口座で払った、自分だけのグループ、収入・振替など */
const NO_SPLIT: SplitPlan = { paidBy: null, splitMode: null, shares: [] };

/**
 * この支出を割るかどうかと、割るならその中身を決める。
 * @param db D1 を包んだ Drizzle
 * @param writerId この記録を書いている人
 * @param input 種類・グループ・金額・払った人・割り方・1 人ずつの負担額(あれば)
 * @param isGroupPersonal input のグループが自分だけのグループかどうか
 * @param account 選んだ口座。無ければ null
 */
export async function resolveSplitPlan(
  db: DB,
  writerId: string,
  input: {
    type: string;
    groupId: string;
    amount: number;
    paidBy?: string | null;
    splitMode?: KakeiboSplitMode | null;
    splits?: { userId: string; amount: number }[];
  },
  isGroupPersonal: boolean,
  account: { groupId: string; isPersonal: boolean } | null,
): Promise<SplitPlan> {
  if (input.type !== "expense" || isGroupPersonal) return NO_SPLIT;
  // 共有口座(記録と同じグループの口座)で払ったなら割らない。それ以外(自分の口座、口座なし)は割る
  if (account && account.groupId === input.groupId) return NO_SPLIT;

  const payerId = input.paidBy?.trim() || writerId;
  // 自分の口座を選んだときは、その口座の持ち主(=writer、自分の口座しか選べない)が払った人になる
  if (account?.isPersonal && payerId !== writerId) {
    throw new HttpError(400, "自分の口座を選んだときは、払った人も自分になります。");
  }

  const memberIds = await groupMemberIds(db, input.groupId);
  if (!memberIds.includes(payerId)) throw new HttpError(400, "払った人は、このグループのメンバーにしてください。");

  const mode = input.splitMode ?? "equal";
  if (mode === "none") return { paidBy: payerId, splitMode: mode, shares: splitNone(input.amount, payerId) };
  if (mode === "equal")
    return { paidBy: payerId, splitMode: mode, shares: splitEqually(input.amount, memberIds, payerId) };

  // custom: 1 人ずつ金額を指定。合計が金額と合うまで保存できない。F-318
  const provided = input.splits ?? [];
  const seen = new Set<string>();
  for (const s of provided) {
    if (seen.has(s.userId)) throw new HttpError(400, "同じ人が 2 回入っています。");
    seen.add(s.userId);
    if (!memberIds.includes(s.userId)) throw new HttpError(400, "このグループのメンバーだけ選べます。");
  }
  if (sumSplitShares(provided) !== input.amount) {
    throw new HttpError(400, "負担額の合計を、記録の金額と同じにしてください。");
  }
  return { paidBy: payerId, splitMode: mode, shares: provided };
}

/**
 * 記録の負担の行を作り直す文を組み立てる。呼び出し側が、記録そのものの書き込みと合わせて
 * `db.batch` に渡し、1 回の書き込みにする。#198
 * @param db D1 を包んだ Drizzle
 * @param expenseId 記録の ID
 * @param shares 人ごとの負担額。空なら消す文だけを返す
 */
export function splitStatements(db: DB, expenseId: string, shares: KakeiboSplitShare[]): unknown[] {
  const statements: unknown[] = [db.delete(kakeiboSplits).where(eq(kakeiboSplits.expenseId, expenseId))];
  if (shares.length > 0) {
    statements.push(
      db
        .insert(kakeiboSplits)
        .values(shares.map((s) => ({ id: crypto.randomUUID(), expenseId, userId: s.userId, amount: s.amount }))),
    );
  }
  return statements;
}
