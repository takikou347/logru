/** 家計簿の拡張が API から読むデータと、書き換え */

import type { CalendarItem, GroupSummary } from "@shared/api-types";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/api/client";
import { useGroups } from "@/api/common";
import { keys } from "@/api/keys";
import type { LoadableQuery } from "@/components/parts/LoadableSection";
import { DAY_MS } from "@/lib/dates";
import { markJustAdded } from "@/modules/calendar/recent-items";
import { kakeiboManifest } from "../manifest";
import type { KakeiboAccountKind } from "../shared/accounts";
import type { KakeiboCategory } from "../shared/categories";
import type { Transfer } from "../shared/settlement";
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

/** グループごとの、自分が関わる送る組み合わせ。「すべて」の画面で使う。#197 */
export type KakeiboGroupSettlement = { groupId: string; transfers: Transfer[] };

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
  /** 「すべて」で絞ったときだけ入る。精算が残っているグループごとの送る組み合わせ。#197 */
  settlements: KakeiboGroupSettlement[] | null;
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

/**
 * 作った直後だけ乗る、その場で入れた記録。決めた日をもう過ぎていたときだけ入る。#198
 * @see useSaveRecurring
 */
export type KakeiboRecurringOccurrence = { id: string; date: string };

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
    // 月やグループを移った直後は、前の中身を出したままにする。切り替わるまで data を空にしない。0078、#195
    placeholderData: (prev) => prev,
  });
}

/** 口座の一覧と残高を読む。F-312 */
export function useKakeiboAccounts(group: string | null, enabled = true) {
  return useQuery({
    queryKey: kakeiboKeys.accounts(group),
    queryFn: () => api<{ accounts: KakeiboAccount[] }>(`/kakeibo/accounts${group ? `?group=${group}` : ""}`),
    enabled,
    select: (data) => data.accounts,
    placeholderData: (prev) => prev,
  });
}

/** 口座の残高と、月ごとのその口座の記録を読む。F-317 */
export function useKakeiboAccountDetail(id: string | null, month: string) {
  return useQuery({
    queryKey: kakeiboKeys.accountDetail(id ?? "", month),
    queryFn: () => api<KakeiboAccountDetail>(`/kakeibo/accounts/${id}/records?month=${month}`),
    enabled: Boolean(id),
    // 月を移るたびに骨組みへ戻さず、前の月の中身を出したままにする。0078、#195
    placeholderData: (prev) => prev,
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
    placeholderData: (prev) => prev,
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
    // 新しく作った記録だけ、一覧に出たときに膨らんで入る動きを付ける。直したときは震えない。0044、0048、#201
    onSuccess: (saved, { id }) => {
      if (!id) markJustAdded(saved.id);
    },
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

/**
 * 口座を消す。記録が残っていれば 409 になる。F-309
 * @param keepalive 画面を閉じるときに送り切る。5 秒の「元に戻す」の間に画面を離れたとき。issue #12、#194
 */
export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, keepalive }: { id: string; keepalive?: boolean }) =>
      api(`/kakeibo/accounts/${id}`, { method: "DELETE", keepalive }),
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
    placeholderData: (prev) => prev,
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

/**
 * 期間の予算を消す。F-323
 * @param keepalive 画面を閉じるときに送り切る。5 秒の「元に戻す」の間に画面を離れたとき。issue #12、#194
 */
export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, keepalive }: { id: string; keepalive?: boolean }) =>
      api(`/kakeibo/budgets/${id}`, { method: "DELETE", keepalive }),
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

/**
 * 定期の記録を作る、直す。F-325
 *
 * 作るときだけ、応答に `occurrence` が乗ることがある。決めた日をもう過ぎていて、その場で今月の分を
 * 1 件入れたとき。カレンダーの日ごとの合計も動くので、カレンダーの読み直しまで含む useInvalidateKakeibo を使う。#198
 */
export function useSaveRecurring() {
  const invalidate = useInvalidateKakeibo();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: KakeiboRecurringSaveInput }) =>
      id
        ? api<KakeiboRecurring & { occurrence?: KakeiboRecurringOccurrence | null }>(`/kakeibo/recurrings/${id}`, {
            method: "PATCH",
            body,
          })
        : api<KakeiboRecurring & { occurrence: KakeiboRecurringOccurrence | null }>("/kakeibo/recurrings", {
            method: "POST",
            body,
          }),
    onSettled: invalidate,
  });
}

/**
 * 定期の記録を消す。F-325
 * @param keepalive 画面を閉じるときに送り切る。5 秒の「元に戻す」の間に画面を離れたとき。issue #12、#194
 */
export function useDeleteRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, keepalive }: { id: string; keepalive?: boolean }) =>
      api(`/kakeibo/recurrings/${id}`, { method: "DELETE", keepalive }),
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

/**
 * 期間を、土台のカレンダー(`GET /api/calendar`)の 1 回の上限に収まるよう分ける。
 * `src/shared/schemas.ts` の `MAX_RANGE_MS`(100 日)に少し余裕を持たせる。0072、F-323、#196
 */
function memoryRangeChunks(from: number, to: number): { from: number; to: number }[] {
  const chunkDays = 90;
  const span = chunkDays * DAY_MS;
  const chunks: { from: number; to: number }[] = [];
  for (let f = from; f < to; f += span) chunks.push({ from: f, to: Math.min(f + span, to) });
  return chunks;
}

/**
 * そのグループの、期間のある思い出(前後およそ 1 年ぶん)。予算の「思い出から選ぶ」に使う。0072、F-323
 *
 * 土台のカレンダーの API だけを使い、思い出の表は読まない。0072。1 回で読める期間には上限があるので、
 * 90 日ずつに分けて並列に読む(`year-range.ts` の `yearChunks` と同じ考え方)。キーは月・週・日の表と
 * 同じ形なので、境目が重なれば読み直さずに済む。範囲は開いたときに 1 度だけ決め、描くたびには作り直さない。
 */
export function useKakeiboMemories(groupId: string): LoadableQuery<CalendarItem[]> {
  const [now] = useState(() => Date.now());
  const from = now - 365 * DAY_MS;
  const to = now + 365 * DAY_MS;
  const results = useQueries({
    queries: memoryRangeChunks(from, to).map((r) => ({
      queryKey: keys.calendar(r.from, r.to),
      queryFn: () => api<{ items: CalendarItem[] }>(`/calendar?from=${r.from}&to=${r.to}`).then((res) => res.items),
      staleTime: 5 * 60 * 1000,
    })),
  });
  const isPending = results.some((r) => r.isPending);
  const errored = results.find((r) => r.isError);
  return {
    data:
      isPending || errored
        ? undefined
        : results.flatMap((r) => r.data ?? []).filter((i) => i.extension === "memories" && i.groupId === groupId),
    error: (errored?.error as Error) ?? null,
    isPending,
    refetch: () => {
      for (const r of results) void r.refetch();
    },
  };
}
