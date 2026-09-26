/** 家計簿の拡張が API から読むデータと、書き換え */

import type { GroupSummary } from "@shared/api-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/api/client";
import { useGroups } from "@/api/common";
import { kakeiboManifest } from "../manifest";
import type { KakeiboAccountKind } from "../shared/accounts";
import type { KakeiboCategory } from "../shared/categories";
import type { KakeiboSplitMode } from "../shared/splits";
import type { KakeiboType } from "../shared/types";

/** 記録に出す口座の参照。見えなければ hidden にして持ち主の表示名だけを持つ */
export type KakeiboAccountRef =
  | { id: string; name: string; kind: KakeiboAccountKind }
  | { id: string; hidden: true; ownerName: string }
  | null;

/** 記録 1 件 */
export type KakeiboExpense = {
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
  /** 人ごとの負担額。立て替えのときだけ入る。userId は、その人がアカウントを消していれば null */
  splits: { userId: string | null; amount: number }[] | null;
};

/** カテゴリごとの合計。支出だけ */
export type KakeiboCategoryTotal = { category: KakeiboCategory; total: number };

/** グループごとの、いま立て替え中の額。自分だけの画面で使う。0072、F-322 */
export type KakeiboDebt = { groupId: string; receivable: number; payable: number };

/** `GET /api/kakeibo` の応答 */
export type KakeiboSummary = {
  totalExpense: number;
  totalIncome: number;
  byCategory: KakeiboCategoryTotal[];
  /** 自分だけのグループに絞ったときだけ入る。共有口座へ入れた額 */
  toShared: number | null;
  /** 自分だけのグループに絞ったときだけ入る。共有口座から受け取った額 */
  fromShared: number | null;
  /** 自分だけのグループに絞ったときだけ入る。その月にグループで負担した額の合計。0072、F-322 */
  sharedBurden: number | null;
  /** 自分だけのグループに絞ったときだけ入る。グループごとの、いま立て替え中の額。0072、F-322 */
  debts: KakeiboDebt[] | null;
  /** 一覧(records)が上限で切れていて、この月にもっと記録があるとき true。合計は切っていない。#199 */
  recordsTruncated: boolean;
  records: KakeiboExpense[];
};

/** 口座 1 件 */
export type KakeiboAccount = {
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

/** よく使うカテゴリの回数 1 件 */
export type KakeiboUsage = { category: KakeiboCategory; count: number };

/** `GET /api/kakeibo/usage` の応答 */
export type KakeiboUsageSummary = { expense: KakeiboUsage[]; income: KakeiboUsage[] };

/** `GET /api/kakeibo/accounts/:id/records` の応答 */
export type KakeiboAccountDetail = { account: KakeiboAccount; records: KakeiboExpense[] };

/** 人ごとの払った額・負担額・差し引き。0072、F-320 */
export type KakeiboSettlementBalance = { userId: string; paid: number; owed: number; net: number };

/** 送る組み合わせ 1 件。0072、F-320 */
export type KakeiboTransfer = { from: string; to: string; amount: number };

/** 精算した記録 1 件。0072、F-321 */
export type KakeiboSettlement = {
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

/** `GET /api/kakeibo/settlement` の応答 */
export type KakeiboSettlementSummary = {
  balances: KakeiboSettlementBalance[];
  transfers: KakeiboTransfer[];
  settlements: KakeiboSettlement[];
};

/** 定期の記録 1 件。0072、F-325 */
export type KakeiboRecurring = {
  id: string;
  groupId: string;
  createdBy: string | null;
  type: KakeiboType;
  amount: number;
  category: KakeiboCategory;
  accountId: string | null;
  toAccountId: string | null;
  memo: string | null;
  dayOfMonth: number;
  startMonth: string;
  endMonth: string | null;
  lastMonth: string | null;
  paused: boolean;
};

/** よく使う記録 1 件。本人のものだけ。0072、F-326 */
export type KakeiboTemplate = {
  id: string;
  name: string;
  type: KakeiboType;
  groupId: string | null;
  category: KakeiboCategory | null;
  accountId: string | null;
  toAccountId: string | null;
  memo: string | null;
  amount: number | null;
};

/** 期間の予算 1 件。使った額を添える。0072、F-323、F-324 */
export type KakeiboBudget = {
  id: string;
  groupId: string;
  createdBy: string | null;
  name: string;
  startDate: string;
  endDate: string;
  amount: number;
  used: number;
};

/** 読み込むデータの名前 */
const kakeiboKeys = {
  all: ["kakeibo"] as const,
  summary: (group: string | null, month: string) => ["kakeibo", "summary", group ?? "all", month] as const,
  accounts: (group: string | null) => ["kakeibo", "accounts", group ?? "all"] as const,
  accountDetail: (id: string, month: string) => ["kakeibo", "account", id, month] as const,
  usage: ["kakeibo", "usage"] as const,
  settlement: (group: string) => ["kakeibo", "settlement", group] as const,
  budgets: (group: string | null) => ["kakeibo", "budgets", group ?? "all"] as const,
  recurrings: ["kakeibo", "recurrings"] as const,
  templates: ["kakeibo", "templates"] as const,
};

/**
 * 家計簿に使えるグループ。自分だけのグループが先頭で、「自分だけ」に当たる。0019
 * 本人が使わないと決めていれば空。使うなら、自分だけのグループと、家計簿を有効にした共有のグループ
 */
export function useKakeiboGroups(): { groups: GroupSummary[]; ready: boolean } {
  const groups = useGroups();
  const list = useMemo(() => {
    const all = groups.data ?? [];
    if (!all.some((g) => g.isPersonal && g.extensions.includes(kakeiboManifest.key))) return [];
    return all.filter((g) => g.isPersonal || g.extensions.includes(kakeiboManifest.key));
  }, [groups.data]);
  return { groups: list, ready: !groups.isPending };
}

/**
 * 選んだ月の合計、カテゴリ別の合計、記録の一覧を読む。F-303
 * @param group 絞るグループ。null なら使えるグループ全部
 * @param month `2026-09` の形の月
 */
export function useKakeiboSummary(group: string | null, month: string, enabled = true) {
  return useQuery({
    queryKey: kakeiboKeys.summary(group, month),
    queryFn: () => api<KakeiboSummary>(`/kakeibo?${group ? `group=${group}&` : ""}month=${month}`),
    enabled,
  });
}

/** 口座の一覧と残高を読む。F-312 */
export function useKakeiboAccounts(group: string | null, enabled = true) {
  return useQuery({
    queryKey: kakeiboKeys.accounts(group),
    queryFn: () => api<{ accounts: KakeiboAccount[] }>(`/kakeibo/accounts${group ? `?group=${group}` : ""}`),
    enabled,
    select: (data) => data.accounts,
  });
}

/** 口座の残高と、月ごとのその口座の記録を読む。F-317 */
export function useKakeiboAccountDetail(id: string | null, month: string) {
  return useQuery({
    queryKey: kakeiboKeys.accountDetail(id ?? "", month),
    queryFn: () => api<KakeiboAccountDetail>(`/kakeibo/accounts/${id}/records?month=${month}`),
    enabled: Boolean(id),
  });
}

/** 本人がよく使うカテゴリの回数。支出と収入で分ける。F-314 */
export function useKakeiboUsage() {
  return useQuery({ queryKey: kakeiboKeys.usage, queryFn: () => api<KakeiboUsageSummary>("/kakeibo/usage") });
}

/** グループの精算を読む。人ごとの払った額・負担額・差し引きと、送る組み合わせ、精算した記録の一覧。F-320 */
export function useKakeiboSettlement(groupId: string | null) {
  return useQuery({
    queryKey: kakeiboKeys.settlement(groupId ?? ""),
    queryFn: () => api<KakeiboSettlementSummary>(`/kakeibo/settlement?group=${groupId}`),
    enabled: Boolean(groupId),
  });
}

/** 家計簿の記録と、カレンダーの日ごとの合計を読み直させる */
function useInvalidateKakeibo() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: kakeiboKeys.all }),
      qc.invalidateQueries({ queryKey: ["calendar"] }),
    ]);
}

/** 記録するときの入力 */
export type KakeiboSaveInput = {
  type: KakeiboType;
  groupId?: string | null;
  date: string;
  amount: number;
  category?: KakeiboCategory | null;
  accountId?: string | null;
  toAccountId?: string | null;
  memo?: string | null;
  /** 立て替えの入力。0072、F-318 */
  paidBy?: string | null;
  splitMode?: KakeiboSplitMode | null;
  splits?: { userId: string; amount: number }[];
};

/** 支出・収入・振替を記録する、直す。F-301、F-307、F-310、F-311 */
export function useSaveExpense() {
  const invalidate = useInvalidateKakeibo();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: KakeiboSaveInput }) =>
      id
        ? api<KakeiboExpense>(`/kakeibo/${id}`, { method: "PATCH", body })
        : api<KakeiboExpense>("/kakeibo", { method: "POST", body }),
    onSettled: invalidate,
  });
}

/**
 * 記録を消す。F-307
 * @param keepalive 画面を閉じるときに送り切る。5 秒の「元に戻す」の間に画面を離れたとき。issue #12
 */
export function useDeleteExpense() {
  const invalidate = useInvalidateKakeibo();
  return useMutation({
    mutationFn: ({ id, keepalive }: { id: string; keepalive?: boolean }) =>
      api(`/kakeibo/${id}`, { method: "DELETE", keepalive }),
    onSettled: invalidate,
  });
}

/** 精算したと記録するときの入力 */
export type KakeiboSettlementSaveInput = {
  groupId: string;
  fromUser: string;
  toUser: string;
  amount: number;
  date: string;
  fromAccountId?: string | null;
  toAccountId?: string | null;
};

/** 精算したと記録する。F-321 */
export function useSaveSettlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: KakeiboSettlementSaveInput) =>
      api<KakeiboSettlement>("/kakeibo/settlements", { method: "POST", body }),
    onSettled: () => qc.invalidateQueries({ queryKey: kakeiboKeys.all }),
  });
}

/**
 * 精算した記録を消す。F-321
 * @param keepalive 画面を閉じるときに送り切る。5 秒の「元に戻す」の間に画面を離れたとき。issue #12
 */
export function useDeleteSettlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, keepalive }: { id: string; keepalive?: boolean }) =>
      api(`/kakeibo/settlements/${id}`, { method: "DELETE", keepalive }),
    onSettled: () => qc.invalidateQueries({ queryKey: kakeiboKeys.all }),
  });
}

/** 口座を作る、直す入力 */
export type KakeiboAccountSaveInput = {
  groupId?: string;
  name?: string;
  kind?: KakeiboAccountKind;
  openingBalance?: number;
  sortOrder?: number;
  archived?: boolean;
};

/** 口座を作る、直す。F-309 */
export function useSaveAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: KakeiboAccountSaveInput }) =>
      id
        ? api<KakeiboAccount>(`/kakeibo/accounts/${id}`, { method: "PATCH", body })
        : api<KakeiboAccount>("/kakeibo/accounts", { method: "POST", body }),
    onSettled: () => qc.invalidateQueries({ queryKey: kakeiboKeys.all }),
  });
}

/** 口座を消す。記録が残っていれば 409 になる。F-309 */
export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/kakeibo/accounts/${id}`, { method: "DELETE" }),
    onSettled: () => qc.invalidateQueries({ queryKey: kakeiboKeys.all }),
  });
}

/** 期間の予算を読む。使った額とともに返る。F-323、F-324 */
export function useKakeiboBudgets(group: string | null, enabled = true) {
  return useQuery({
    queryKey: kakeiboKeys.budgets(group),
    queryFn: () => api<{ budgets: KakeiboBudget[] }>(`/kakeibo/budgets${group ? `?group=${group}` : ""}`),
    enabled,
    select: (data) => data.budgets,
  });
}

/** 期間の予算を作る、直す入力 */
export type KakeiboBudgetSaveInput = {
  groupId?: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  amount?: number;
};

/** 期間の予算を作る、直す。F-323 */
export function useSaveBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: KakeiboBudgetSaveInput }) =>
      id
        ? api<KakeiboBudget>(`/kakeibo/budgets/${id}`, { method: "PATCH", body })
        : api<KakeiboBudget>("/kakeibo/budgets", { method: "POST", body }),
    onSettled: () => qc.invalidateQueries({ queryKey: kakeiboKeys.all }),
  });
}

/** 期間の予算を消す。F-323 */
export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/kakeibo/budgets/${id}`, { method: "DELETE" }),
    onSettled: () => qc.invalidateQueries({ queryKey: kakeiboKeys.all }),
  });
}

/** 本人が作った定期の記録を読む。F-325 */
export function useKakeiboRecurrings() {
  return useQuery({
    queryKey: kakeiboKeys.recurrings,
    queryFn: () => api<{ recurrings: KakeiboRecurring[] }>("/kakeibo/recurrings"),
    select: (data) => data.recurrings,
  });
}

/** 定期の記録を作る、直す入力 */
export type KakeiboRecurringSaveInput = {
  groupId?: string;
  type?: KakeiboType;
  amount?: number;
  category?: KakeiboCategory;
  accountId?: string | null;
  memo?: string | null;
  dayOfMonth?: number;
  startMonth?: string;
  endMonth?: string | null;
  paused?: boolean;
};

/** 定期の記録を作る、直す。F-325 */
export function useSaveRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: KakeiboRecurringSaveInput }) =>
      id
        ? api<KakeiboRecurring>(`/kakeibo/recurrings/${id}`, { method: "PATCH", body })
        : api<KakeiboRecurring>("/kakeibo/recurrings", { method: "POST", body }),
    onSettled: () => qc.invalidateQueries({ queryKey: kakeiboKeys.all }),
  });
}

/** 定期の記録を消す。F-325 */
export function useDeleteRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/kakeibo/recurrings/${id}`, { method: "DELETE" }),
    onSettled: () => qc.invalidateQueries({ queryKey: kakeiboKeys.all }),
  });
}

/** 本人のよく使う記録を読む。F-326 */
export function useKakeiboTemplates() {
  return useQuery({
    queryKey: kakeiboKeys.templates,
    queryFn: () => api<{ templates: KakeiboTemplate[] }>("/kakeibo/templates"),
    select: (data) => data.templates,
  });
}

/** よく使う記録を作る、直す入力 */
export type KakeiboTemplateSaveInput = {
  name?: string;
  type?: KakeiboType;
  groupId?: string | null;
  category?: KakeiboCategory | null;
  accountId?: string | null;
  memo?: string | null;
  amount?: number | null;
};

/** よく使う記録を作る、直す。F-326 */
export function useSaveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: KakeiboTemplateSaveInput }) =>
      id
        ? api<KakeiboTemplate>(`/kakeibo/templates/${id}`, { method: "PATCH", body })
        : api<KakeiboTemplate>("/kakeibo/templates", { method: "POST", body }),
    onSettled: () => qc.invalidateQueries({ queryKey: kakeiboKeys.all }),
  });
}

/**
 * よく使う記録を消す。F-326
 * @param keepalive 画面を閉じるときに送り切る。5 秒の「元に戻す」の間に画面を離れたとき。issue #12
 */
export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, keepalive }: { id: string; keepalive?: boolean }) =>
      api(`/kakeibo/templates/${id}`, { method: "DELETE", keepalive }),
    onSettled: () => qc.invalidateQueries({ queryKey: kakeiboKeys.all }),
  });
}
