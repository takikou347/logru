/** お知らせの一覧、未読の数、既読にする API の hook。#32 */
import type { NotificationPage } from "@shared/api-types";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

const keys = {
  unreadCount: ["notifications", "unread-count"] as const,
  list: ["notifications", "list"] as const,
};

/** 未読の数。ベルの印に出す */
export function useUnreadCount(enabled: boolean) {
  return useQuery({
    queryKey: keys.unreadCount,
    queryFn: () => api<{ count: number }>("/notifications/unread-count").then((r) => r.count),
    enabled,
    // ベルは押していない間も新しい未読に気付けるよう、少しの間隔で読み直す
    refetchInterval: enabled ? 60_000 : false,
  });
}

/** 一覧を 25 件ずつ読む。シートを開いたときだけ動かす */
export function useNotificationList(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: keys.list,
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      api<NotificationPage>(pageParam ? `/notifications?cursor=${pageParam}` : "/notifications"),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled,
  });
}

/** 1 件を既読にする。押して開くときに呼ぶ */
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/notifications/${id}/read`, { method: "PUT" }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.list });
      qc.invalidateQueries({ queryKey: keys.unreadCount });
    },
  });
}

/** すべて既読にする */
export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/notifications/read-all", { method: "PUT" }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.list });
      qc.invalidateQueries({ queryKey: keys.unreadCount });
    },
  });
}
