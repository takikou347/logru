/** 家計簿の拡張が API から読むデータと、書き換え */

import type { GroupSummary } from "@shared/api-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/api/client";
import { useGroups } from "@/api/common";
import { kakeiboManifest } from "../manifest";
import type { KakeiboCategory } from "../shared/categories";

/** 記録 1 件 */
export type KakeiboExpense = {
  id: string;
  groupId: string;
  createdBy: string | null;
  date: string;
  amount: number;
  category: KakeiboCategory;
  memo: string | null;
};

/** カテゴリごとの合計 */
export type KakeiboCategoryTotal = { category: KakeiboCategory; total: number };

/** `GET /api/kakeibo` の応答 */
export type KakeiboSummary = { total: number; byCategory: KakeiboCategoryTotal[]; records: KakeiboExpense[] };

/** 読み込むデータの名前 */
const kakeiboKeys = {
  all: ["kakeibo"] as const,
  summary: (group: string | null, month: string) => ["kakeibo", "summary", group ?? "all", month] as const,
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

/** 家計簿の記録と、カレンダーの日ごとの合計を読み直させる */
function useInvalidateKakeibo() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: kakeiboKeys.all }),
      qc.invalidateQueries({ queryKey: ["calendar"] }),
    ]);
}

/** 支出を記録する、直す。F-301、F-307 */
export function useSaveExpense() {
  const invalidate = useInvalidateKakeibo();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Record<string, unknown> }) =>
      id
        ? api<KakeiboExpense>(`/kakeibo/${id}`, { method: "PATCH", body })
        : api<KakeiboExpense>("/kakeibo", { method: "POST", body }),
    onSettled: invalidate,
  });
}

/** 支出を消す。F-307 */
export function useDeleteExpense() {
  const invalidate = useInvalidateKakeibo();
  return useMutation({
    mutationFn: (id: string) => api(`/kakeibo/${id}`, { method: "DELETE" }),
    onSettled: invalidate,
  });
}
