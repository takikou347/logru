/** 共有リストの拡張が API から読むデータと、書き換え */

import type { GroupSummary } from "@shared/api-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/api/client";
import { useGroups } from "@/api/common";
import { listsManifest } from "../manifest";

/** リストの一覧の 1 件 */
export type ListSummary = {
  id: string;
  groupId: string;
  createdBy: string | null;
  title: string;
  date: string | null;
  itemCount: number;
  remainingCount: number;
  createdAt: number;
};

/** 項目 1 件 */
export type ListItem = {
  id: string;
  listId: string;
  text: string;
  checked: boolean;
  checkedBy: string | null;
  checkedAt: number | null;
  createdBy: string | null;
  createdAt: number;
};

/** `GET /api/lists/:id` の応答 */
export type ListDetail = ListSummary & { items: ListItem[] };

/** 画面を開いている間、ほかの人の変更を拾うために読み直す間隔。F-207 */
const REFRESH_MS = 5_000;

const listsKeys = {
  all: ["lists"] as const,
  list: (group: string | null) => ["lists", "list", group ?? "all"] as const,
  detail: (id: string) => ["lists", "detail", id] as const,
};

/**
 * リストに使えるグループ。自分だけのグループが先頭で、「自分だけ」に当たる。0019
 * 本人が使わないと決めていれば空。使うなら、自分だけのグループと、リストを有効にした共有のグループ
 */
export function useListsGroups(): { groups: GroupSummary[]; ready: boolean } {
  const groups = useGroups();
  const list = useMemo(() => {
    const all = groups.data ?? [];
    if (!all.some((g) => g.isPersonal && g.extensions.includes(listsManifest.key))) return [];
    return all.filter((g) => g.isPersonal || g.extensions.includes(listsManifest.key));
  }, [groups.data]);
  return { groups: list, ready: !groups.isPending };
}

/** リストの一覧。新しい順。F-202、F-209 */
export function useLists(group: string | null, enabled = true) {
  return useQuery({
    queryKey: listsKeys.list(group),
    queryFn: () => api<{ lists: ListSummary[] }>(`/lists${group ? `?group=${group}` : ""}`).then((r) => r.lists),
    enabled,
  });
}

/** 1 件のリストと項目。開いている間は定期に読み直す。F-207 */
export function useListDetail(id: string | null) {
  return useQuery({
    queryKey: listsKeys.detail(id ?? ""),
    queryFn: () => api<ListDetail>(`/lists/${id}`),
    enabled: id !== null,
    refetchInterval: id !== null ? REFRESH_MS : false,
  });
}

/** リストと項目を読み直させる */
function useInvalidateLists() {
  const qc = useQueryClient();
  return () =>
    Promise.all([qc.invalidateQueries({ queryKey: listsKeys.all }), qc.invalidateQueries({ queryKey: ["calendar"] })]);
}

/** リストを作る。F-201 */
export function useCreateList() {
  const invalidate = useInvalidateLists();
  return useMutation({
    mutationFn: (body: { groupId: string; title: string; date?: string | null }) =>
      api<ListSummary>("/lists", { method: "POST", body }),
    onSettled: invalidate,
  });
}

/** リストの名前・日付を直す、消す。F-206、F-208 */
export function usePatchList(id: string) {
  const invalidate = useInvalidateLists();
  return useMutation({
    mutationFn: (body: { title?: string; date?: string | null }) =>
      api<ListDetail>(`/lists/${id}`, { method: "PATCH", body }),
    onSettled: invalidate,
  });
}

/** リストを消す。F-206 */
export function useDeleteList() {
  const invalidate = useInvalidateLists();
  return useMutation({
    mutationFn: (id: string) => api(`/lists/${id}`, { method: "DELETE" }),
    onSettled: invalidate,
  });
}

/** 項目を足す。F-203 */
export function useAddItem(listId: string) {
  const invalidate = useInvalidateLists();
  return useMutation({
    mutationFn: (text: string) => api<ListItem>(`/lists/${listId}/items`, { method: "POST", body: { text } }),
    onSettled: invalidate,
  });
}

/** 項目のチェックを付ける、外す。F-204 */
export function useToggleItem(listId: string) {
  const invalidate = useInvalidateLists();
  return useMutation({
    mutationFn: ({ id, checked }: { id: string; checked: boolean }) =>
      api<ListItem>(`/lists/${listId}/items/${id}`, { method: "PATCH", body: { checked } }),
    onSettled: invalidate,
  });
}

/**
 * 項目を消す。F-205
 * @param keepalive 画面を閉じるときに送り切る。5 秒の「元に戻す」の間に画面を離れたとき。issue #12
 */
export function useDeleteItem(listId: string) {
  const invalidate = useInvalidateLists();
  return useMutation({
    mutationFn: ({ id, keepalive }: { id: string; keepalive?: boolean }) =>
      api(`/lists/${listId}/items/${id}`, { method: "DELETE", keepalive }),
    onSettled: invalidate,
  });
}
