/**
 * 記録・口座を画面へ返す形と、見える範囲の決まり。0069
 *
 * 振替の相手の口座が、見ている人の使えるグループに無ければ、名前と種類を返さず、
 * 口座のグループの持ち主の表示名だけを返す。画面はそれを「〇〇さんの口座」と出す。
 */
import type { DB } from "@server/core/db/client";
import { groups, users } from "@server/core/db/schema";
import { eq, inArray, or } from "drizzle-orm";
import type { KakeiboAccountKind } from "../shared/accounts";
import type { KakeiboCategory } from "../shared/categories";
import type { KakeiboType } from "../shared/types";
import { type KakeiboAccountRow, type KakeiboExpenseRow, kakeiboAccounts, kakeiboExpenses } from "./schema";

/** グループにいない人の表示名の代わり。#152 と同じ言い方 */
const GONE_NAME = "退会した人";

/** 記録に出す口座の参照。見えなければ hidden にして持ち主の表示名だけを返す */
export type KakeiboAccountRef =
  | { id: string; name: string; kind: KakeiboAccountKind }
  | { id: string; hidden: true; ownerName: string }
  | null;

type AccountRefRow = { id: string; groupId: string; name: string; kind: KakeiboAccountKind; ownerName: string | null };

/** account_id / to_account_id が指す口座の名前などを、まとめて 1 度に読む */
export async function loadAccountRefRows(db: DB, ids: string[]): Promise<Map<string, AccountRefRow>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await db
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
    .where(inArray(kakeiboAccounts.id, unique));
  return new Map(rows.map((r) => [r.id, r as AccountRefRow]));
}

/**
 * 口座の参照を、見ている人に見せてよい形にする。
 * @param refs loadAccountRefRows が返した表
 * @param visibleGroupIds 見ている人が家計簿に使える、全部のグループ(絞り込みは無視する)
 * @param id account_id か to_account_id。無ければ null
 */
export function toAccountRef(
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
};

/**
 * 記録の一覧を DTO にする。参照する口座をまとめて読んでから変換する。
 * @param visibleGroupIds 見ている人が家計簿に使える、全部のグループ
 */
export async function toExpenseDtos(
  db: DB,
  rows: KakeiboExpenseRow[],
  visibleGroupIds: Set<string>,
): Promise<KakeiboExpenseDto[]> {
  const ids = rows.flatMap((r) => [r.accountId, r.toAccountId].filter((x): x is string => x !== null));
  const refs = await loadAccountRefRows(db, ids);
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
 * 残高 = 始まりの残高 + 収入 - 支出 - 出た振替 + 入った振替
 * @returns 口座の ID から残高への対応
 */
export async function computeBalances(
  db: DB,
  accounts: Pick<KakeiboAccountRow, "id" | "openingBalance">[],
): Promise<Map<string, number>> {
  const balances = new Map(accounts.map((a) => [a.id, a.openingBalance]));
  if (accounts.length === 0) return balances;
  const ids = accounts.map((a) => a.id);
  const rows = await db
    .select({
      type: kakeiboExpenses.type,
      amount: kakeiboExpenses.amount,
      accountId: kakeiboExpenses.accountId,
      toAccountId: kakeiboExpenses.toAccountId,
    })
    .from(kakeiboExpenses)
    .where(or(inArray(kakeiboExpenses.accountId, ids), inArray(kakeiboExpenses.toAccountId, ids)));
  for (const row of rows) {
    if (row.accountId && balances.has(row.accountId)) {
      // 収入は足す。支出と、振替の出す元は引く
      const delta = row.type === "income" ? row.amount : -row.amount;
      balances.set(row.accountId, balances.get(row.accountId)! + delta);
    }
    if (row.type === "transfer" && row.toAccountId && balances.has(row.toAccountId)) {
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
