/** 思い出の拡張が API から読むデータと、書き換え */

import type { GroupSummary } from "@shared/api-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { useGroups } from "@/api/common";
import { memoriesManifest } from "../manifest";
import type { ItemKind, Memory, MemoryDetail, MemoryItem, MemoryList, MemoryRecord } from "../shared/types";

/** 読み込むデータの名前 */
export const memoryKeys = {
  all: ["memories"] as const,
  list: (group: string | null) => ["memories", "list", group ?? "all"] as const,
  detail: (id: string) => ["memories", "detail", id] as const,
  records: (group: string, from: number, to: number) => ["memories", "records", group, from, to] as const,
};

/**
 * 思い出に使えるグループ。自分だけのグループが先頭で、「共有しない」に当たる。0019
 * 本人が使わないと決めていれば空。使うなら、自分だけのグループと、思い出を有効にした共有のグループ
 */
export function useMemoryGroups(): { groups: GroupSummary[]; ready: boolean } {
  const groups = useGroups();
  const list = useMemo(() => {
    const all = groups.data ?? [];
    if (!all.some((g) => g.isPersonal && g.extensions.includes(memoriesManifest.key))) return [];
    return all.filter((g) => g.isPersonal || g.extensions.includes(memoriesManifest.key));
  }, [groups.data]);
  return { groups: list, ready: !groups.isPending };
}

/**
 * 思い出の一覧と、最近の記録を読む。
 * @param group 絞るグループ。null なら全部
 */
export function useMemoryList(group: string | null) {
  return useQuery({
    queryKey: memoryKeys.list(group),
    queryFn: () => api<MemoryList>(`/memories${group ? `?group=${group}` : ""}`),
  });
}

/** 思い出 1 件と、しおりの行を読む */
export function useMemory(id: string, enabled = true) {
  return useQuery({ queryKey: memoryKeys.detail(id), queryFn: () => api<MemoryDetail>(`/memories/${id}`), enabled });
}

/**
 * 期間とグループの記録を読む。
 * @param groups 読むグループの ID。カンマで区切る
 */
export function useRecords(groups: string, from: number, to: number, enabled = true) {
  return useQuery({
    queryKey: memoryKeys.records(groups, from, to),
    queryFn: () =>
      api<{ records: MemoryRecord[] }>(`/memories/records?group=${groups}&from=${from}&to=${to}`).then(
        (r) => r.records,
      ),
    enabled: enabled && groups.length > 0,
  });
}

/** 思い出の拡張のデータを、全部読み直させる。カレンダーの帯と記録の数も変わるので、カレンダーも読み直す */
export function useInvalidateMemories() {
  const qc = useQueryClient();
  return () =>
    Promise.all([qc.invalidateQueries({ queryKey: memoryKeys.all }), qc.invalidateQueries({ queryKey: ["calendar"] })]);
}

/** しおりの行を足す、直す、消す。押した瞬間に画面に効かせ、失敗したら戻す */
export function useItemMutations(memoryId: string) {
  const qc = useQueryClient();
  const key = memoryKeys.detail(memoryId);
  const patchLocal = (fn: (items: MemoryItem[]) => MemoryItem[]) => {
    const prev = qc.getQueryData<MemoryDetail>(key);
    if (prev) qc.setQueryData<MemoryDetail>(key, { ...prev, items: fn(prev.items) });
    return { prev };
  };
  const rollback = (e: unknown, _v: unknown, ctx: { prev?: MemoryDetail } | undefined) => {
    if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    toast.error((e as Error).message);
  };
  const settle = () => qc.invalidateQueries({ queryKey: key });

  const add = useMutation({
    mutationFn: (input: {
      kind: ItemKind;
      title: string;
      place?: string | null;
      dayIndex?: number | null;
      assigneeId?: string | null;
      dueOn?: string | null;
    }) => api<MemoryItem>(`/memories/${memoryId}/items`, { method: "POST", body: input }),
    onError: (e) => toast.error((e as Error).message),
    onSettled: settle,
  });
  const update = useMutation({
    mutationFn: ({
      id,
      ...patch
    }: {
      id: string;
      done?: boolean;
      title?: string;
      assigneeId?: string | null;
      dueOn?: string | null;
      dayIndex?: number | null;
      place?: string | null;
    }) => api<MemoryItem>(`/memories/${memoryId}/items/${id}`, { method: "PATCH", body: patch }),
    onMutate: async ({ id, done, ...rest }) => {
      await qc.cancelQueries({ queryKey: key });
      return patchLocal((items) =>
        items.map((i) =>
          i.id === id ? { ...i, ...rest, ...(done === undefined ? {} : { doneAt: done ? Date.now() : null }) } : i,
        ),
      );
    },
    onError: rollback,
    onSettled: settle,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/memories/${memoryId}/items/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      return patchLocal((items) => items.filter((i) => i.id !== id));
    },
    onError: rollback,
    onSettled: settle,
  });
  const copy = useMutation({
    mutationFn: (fromMemoryId: string) =>
      api<{ items: MemoryItem[]; copied: number }>(`/memories/${memoryId}/items/copy`, {
        method: "POST",
        body: { fromMemoryId },
      }),
    onSuccess: (r) =>
      toast(r.copied ? `持ち物を ${r.copied} 件コピーしました` : "コピーできる持ち物はありませんでした"),
    onError: (e) => toast.error((e as Error).message),
    onSettled: settle,
  });
  return { add, update, remove, copy };
}

/** いいねを付ける、外す。押した瞬間に数を変え、失敗したら戻す。F-116 */
export function useLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ record, on }: { record: MemoryRecord; on: boolean; me: string }) =>
      api<{ likes: string[] }>(`/memories/records/${record.id}/like`, { method: on ? "PUT" : "DELETE" }),
    onMutate: async ({ record, on, me }) => {
      const patch = (r: MemoryRecord) =>
        r.id === record.id
          ? { ...r, likes: on ? [...r.likes.filter((u) => u !== me), me] : r.likes.filter((u) => u !== me) }
          : r;
      qc.setQueriesData<MemoryRecord[]>({ queryKey: ["memories", "records"] }, (old) => old?.map(patch));
      qc.setQueriesData<MemoryList>({ queryKey: ["memories", "list"] }, (old) =>
        old ? { ...old, recent: old.recent.map(patch) } : old,
      );
    },
    onError: (e) => toast.error((e as Error).message),
    onSettled: () => qc.invalidateQueries({ queryKey: ["memories", "records"] }),
  });
}

/** 予定を思い出に入れる、外す。予定の保存が済んでから呼ぶ */
export function useLinkEventToMemory() {
  return useMutation({
    mutationFn: ({ memoryId, itemId, included }: { memoryId: string; itemId: string; included: boolean }) =>
      api(`/memories/${memoryId}/events/${itemId}`, { method: "PUT", body: { included } }),
  });
}

/** 思い出を作る、直す */
export function useSaveMemory() {
  const invalidate = useInvalidateMemories();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Record<string, unknown> }) =>
      id
        ? api<Memory>(`/memories/${id}`, { method: "PATCH", body })
        : api<Memory>("/memories", { method: "POST", body }),
    onSettled: invalidate,
  });
}

/** 思い出を削除する。しおりは消えるが、記録と写真は残る */
export function useDeleteMemory() {
  return useMutation({
    mutationFn: (id: string) => api(`/memories/${id}`, { method: "DELETE" }),
  });
}

/** 記録を作る、直す */
export function useSaveRecord() {
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Record<string, unknown> }) =>
      id
        ? api(`/memories/records/${id}`, { method: "PATCH", body })
        : api("/memories/records", { method: "POST", body }),
  });
}

/** 記録を消す。画面を閉じた後、5 秒待ってから送るので keepalive で送り切る */
export function useDeleteRecord() {
  return useMutation({
    mutationFn: (id: string) => api(`/memories/records/${id}`, { method: "DELETE", keepalive: true }),
  });
}
