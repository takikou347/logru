/** 家計簿の拡張が API から読むデータと、書き換え */

import type { GroupSummary } from "@shared/api-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/api/client";
import { useGroups } from "@/api/common";
import { kakeiboManifest } from "../manifest";
import type { KakeiboAccountKind } from "../shared/accounts";
import type { KakeiboCategory } from "../shared/categories";
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
};

/** カテゴリごとの合計。支出だけ */
export type KakeiboCategoryTotal = { category: KakeiboCategory; total: number };

/** `GET /api/kakeibo` の応答 */
export type KakeiboSummary = {
  totalExpense: number;
  totalIncome: number;
  byCategory: KakeiboCategoryTotal[];
  /** 自分だけのグループに絞ったときだけ入る。共有口座へ入れた額 */
  toShared: number | null;
  /** 自分だけのグループに絞ったときだけ入る。共有口座から受け取った額 */
  fromShared: number | null;
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

/** 読み込むデータの名前 */
const kakeiboKeys = {
  all: ["kakeibo"] as const,
  summary: (group: string | null, month: string) => ["kakeibo", "summary", group ?? "all", month] as const,
  accounts: (group: string | null) => ["kakeibo", "accounts", group ?? "all"] as const,
  accountDetail: (id: string, month: string) => ["kakeibo", "account", id, month] as const,
  usage: ["kakeibo", "usage"] as const,
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
