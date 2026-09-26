/**
 * 記録・口座を画面へ返す形と、見える範囲の決まり。0069
 *
 * 振替の相手の口座が、見ている人の使えるグループに無ければ、名前と種類を返さず、
 * 口座のグループの持ち主の表示名だけを返す。画面はそれを「〇〇さんの口座」と出す。
 */

import { chunk, D1_CHUNK, readByChunk } from "@server/core/db/chunk";
import type { DB } from "@server/core/db/client";
import { groups, users } from "@server/core/db/schema";
import { eq, inArray, or } from "drizzle-orm";
import type { KakeiboAccountKind } from "../shared/accounts";
import type { KakeiboCategory } from "../shared/categories";
import type { KakeiboSplitMode } from "../shared/splits";
import type { KakeiboType } from "../shared/types";
import {
  type KakeiboAccountRow,
  type KakeiboExpenseRow,
  type KakeiboSettlementRow,
  kakeiboAccounts,
  kakeiboExpenses,
  kakeiboSettlements,
  kakeiboSplits,
} from "./schema";

/** グループにいない人の表示名の代わり。#152 と同じ言い方 */
const GONE_NAME = "退会した人";

/** 記録に出す口座の参照。見えなければ hidden にして持ち主の表示名だけを返す */
type KakeiboAccountRef =
  | { id: string; name: string; kind: KakeiboAccountKind }
  | { id: string; hidden: true; ownerName: string }
  | null;

type AccountRefRow = { id: string; groupId: string; name: string; kind: KakeiboAccountKind; ownerName: string | null };

/** account_id / to_account_id が指す口座の名前などを、まとめて 1 度に読む */
async function loadAccountRefRows(db: DB, ids: string[]): Promise<Map<string, AccountRefRow>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await readByChunk(unique, (part) =>
    db
      .select({
        id: kakeiboAccounts.id,
        groupId: kakeiboAccounts.groupId,
        name: kakeiboAccounts.name,
        kind: kakeiboAccounts.kind,
        ownerName: users.name,
      })
      .from(kakeiboAccounts)
      .leftJoin(groups, eq(groups.id, kakeiboAccounts.groupId))
      .leftJoin(users, eq(users.id, groups.createdBy))
      .where(inArray(kakeiboAccounts.id, part)),
  );
  return new Map(rows.map((r) => [r.id, r as AccountRefRow]));
}

/**
 * 口座の参照を、見ている人に見せてよい形にする。
 * @param refs loadAccountRefRows が返した表
 * @param visibleGroupIds 見ている人が家計簿に使える、全部のグループ(絞り込みは無視する)
 * @param id account_id か to_account_id。無ければ null
 */
function toAccountRef(
  refs: Map<string, AccountRefRow>,
  visibleGroupIds: Set<string>,
  id: string | null,
): KakeiboAccountRef {
  if (!id) return null;
  const row = refs.get(id);
  if (!row) return null;
  if (visibleGroupIds.has(row.groupId)) return { id: row.id, name: row.name, kind: row.kind };
  return { id: row.id, hidden: true, ownerName: row.ownerName ?? GONE_NAME };
}

/** 画面に返す記録の形 */
export type KakeiboExpenseDto = {
  id: string;
  groupId: string;
  createdBy: string | null;
  type: KakeiboType;
  date: string;
  amount: number;
  category: KakeiboCategory;
  account: KakeiboAccountRef;
  toAccount: KakeiboAccountRef;
  memo: string | null;
  /** 払った人。立て替えのときだけ入る。0072、F-318 */
  paidBy: string | null;
  splitMode: KakeiboSplitMode | null;
  /**
   * 人ごとの負担額。グループには金額と割り方だけ見せ、口座は見せない。0072
   * userId は、負担した人がアカウントを消していれば null(退会した人)
   */
  splits: { userId: string | null; amount: number }[] | null;
};

/**
 * 記録の一覧を DTO にする。参照する口座と、立て替えの負担額をまとめて読んでから変換する。
 * @param visibleGroupIds 見ている人が家計簿に使える、全部のグループ
 */
export async function toExpenseDtos(
  db: DB,
  rows: KakeiboExpenseRow[],
  visibleGroupIds: Set<string>,
): Promise<KakeiboExpenseDto[]> {
  const ids = rows.flatMap((r) => [r.accountId, r.toAccountId].filter((x): x is string => x !== null));
  const refs = await loadAccountRefRows(db, ids);
  const expenseIds = rows.filter((r) => r.splitMode !== null).map((r) => r.id);
  const splitRows = await readByChunk(expenseIds, (part) =>
    db
      .select({ expenseId: kakeiboSplits.expenseId, userId: kakeiboSplits.userId, amount: kakeiboSplits.amount })
      .from(kakeiboSplits)
      .where(inArray(kakeiboSplits.expenseId, part)),
  );
  return rows.map((row) => ({
    id: row.id,
    groupId: row.groupId,
    createdBy: row.createdBy,
    type: row.type,
    date: row.date,
    amount: row.amount,
    category: row.category,
    account: toAccountRef(refs, visibleGroupIds, row.accountId),
    toAccount: toAccountRef(refs, visibleGroupIds, row.toAccountId),
    memo: row.memo,
    paidBy: row.paidBy,
    splitMode: row.splitMode,
    splits:
      row.splitMode === null
        ? null
        : splitRows.filter((s) => s.expenseId === row.id).map((s) => ({ userId: s.userId, amount: s.amount })),
  }));
}

/** 画面に返す口座の形 */
export type KakeiboAccountDto = {
  id: string;
  groupId: string;
  createdBy: string | null;
  name: string;
  kind: KakeiboAccountKind;
  openingBalance: number;
  balance: number;
  sortOrder: number;
  archivedAt: number | null;
};

/**
 * 口座の残高。読むたびに数える。記録がどのグループにあっても、その口座を指していれば数える。0069
 *
 * 残高 = 始まりの残高 + 収入 - 支出 - 出た振替 + 入った振替 - 送った精算 + 受け取った精算。0072
 * @returns 口座の ID から残高への対応
 */
export async function computeBalances(
  db: DB,
  accounts: Pick<KakeiboAccountRow, "id" | "openingBalance">[],
): Promise<Map<string, number>> {
  const balances = new Map(accounts.map((a) => [a.id, a.openingBalance]));
  if (accounts.length === 0) return balances;
  const ids = accounts.map((a) => a.id);
  // account_id と to_account_id の両方に inArray を使う(OR)ので、1 回に渡す ID 数は半分にする。
  // チャンクをまたいで同じ行が 2 回返ることがあるため、id で束ねて重ねを消す。#199
  const halfChunk = Math.max(1, Math.floor(D1_CHUNK / 2));

  const expenseRows = new Map<
    string,
    Pick<KakeiboExpenseRow, "id" | "type" | "amount" | "accountId" | "toAccountId">
  >();
  for (const part of chunk(ids, halfChunk)) {
    const rows = await db
      .select({
        id: kakeiboExpenses.id,
        type: kakeiboExpenses.type,
        amount: kakeiboExpenses.amount,
        accountId: kakeiboExpenses.accountId,
        toAccountId: kakeiboExpenses.toAccountId,
      })
      .from(kakeiboExpenses)
      .where(or(inArray(kakeiboExpenses.accountId, part), inArray(kakeiboExpenses.toAccountId, part)));
    for (const row of rows) expenseRows.set(row.id, row);
  }
  for (const row of expenseRows.values()) {
    if (row.accountId && balances.has(row.accountId)) {
      // 収入は足す。支出と、振替の出す元は引く
      const delta = row.type === "income" ? row.amount : -row.amount;
      balances.set(row.accountId, balances.get(row.accountId)! + delta);
    }
    if (row.type === "transfer" && row.toAccountId && balances.has(row.toAccountId)) {
      balances.set(row.toAccountId, balances.get(row.toAccountId)! + row.amount);
    }
  }

  const settlementRows = new Map<
    string,
    Pick<KakeiboSettlementRow, "id" | "amount" | "fromAccountId" | "toAccountId">
  >();
  for (const part of chunk(ids, halfChunk)) {
    const rows = await db
      .select({
        id: kakeiboSettlements.id,
        amount: kakeiboSettlements.amount,
        fromAccountId: kakeiboSettlements.fromAccountId,
        toAccountId: kakeiboSettlements.toAccountId,
      })
      .from(kakeiboSettlements)
      .where(or(inArray(kakeiboSettlements.fromAccountId, part), inArray(kakeiboSettlements.toAccountId, part)));
    for (const row of rows) settlementRows.set(row.id, row);
  }
  for (const row of settlementRows.values()) {
    if (row.fromAccountId && balances.has(row.fromAccountId)) {
      balances.set(row.fromAccountId, balances.get(row.fromAccountId)! - row.amount);
    }
    if (row.toAccountId && balances.has(row.toAccountId)) {
      balances.set(row.toAccountId, balances.get(row.toAccountId)! + row.amount);
    }
  }
  return balances;
}

/** 口座の表の 1 行を DTO にする。balances は computeBalances が返したもの */
export function toAccountDto(row: KakeiboAccountRow, balances: Map<string, number>): KakeiboAccountDto {
  return {
    id: row.id,
    groupId: row.groupId,
    createdBy: row.createdBy,
    name: row.name,
    kind: row.kind,
    openingBalance: row.openingBalance,
    balance: balances.get(row.id) ?? row.openingBalance,
    sortOrder: row.sortOrder,
    archivedAt: row.archivedAt ? row.archivedAt.getTime() : null,
  };
}

/** 画面に返す精算した記録の形。口座は、ほかの人の記録と同じ「〇〇さんの口座」の決まりに従う。0072、F-321 */
export type KakeiboSettlementDto = {
  id: string;
  groupId: string;
  createdBy: string | null;
  fromUser: string | null;
  toUser: string | null;
  amount: number;
  date: string;
  fromAccount: KakeiboAccountRef;
  toAccount: KakeiboAccountRef;
};

/**
 * 精算した記録の一覧を DTO にする。
 * @param visibleGroupIds 見ている人が家計簿に使える、全部のグループ
 */
export async function toSettlementDtos(
  db: DB,
  rows: KakeiboSettlementRow[],
  visibleGroupIds: Set<string>,
): Promise<KakeiboSettlementDto[]> {
  const ids = rows.flatMap((r) => [r.fromAccountId, r.toAccountId].filter((x): x is string => x !== null));
  const refs = await loadAccountRefRows(db, ids);
  return rows.map((row) => ({
    id: row.id,
    groupId: row.groupId,
    createdBy: row.createdBy,
    fromUser: row.fromUser,
    toUser: row.toUser,
    amount: row.amount,
    date: row.date,
    fromAccount: toAccountRef(refs, visibleGroupIds, row.fromAccountId),
    toAccount: toAccountRef(refs, visibleGroupIds, row.toAccountId),
  }));
}
