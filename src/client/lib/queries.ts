/** API から読むデータ。TanStack Query で持ち、画面の間で使い回す */
import { QueryClient, useQuery } from "@tanstack/react-query";
import type { CalendarItem, GroupSummary, Me } from "../../shared/api-types";
import { ApiError, api } from "./api";

/** アプリで 1 つの QueryClient。4xx は取り直しても変わらないので、取り直さない */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
});

/** 読み込むデータの名前。書き換えた後に、ここを指して読み直させる */
export const keys = {
  me: ["me"] as const,
  groups: ["groups"] as const,
  calendar: (from: number, to: number) => ["calendar", from, to] as const,
  extensions: (groupId: string) => ["extensions", groupId] as const,
  extensionOverview: ["extension-overview"] as const,
  invite: (token: string) => ["invite", token] as const,
};

/**
 * 自分の情報と設定を読む。
 * @param enabled ログインしているときだけ true にする
 */
export function useMe(enabled = true) {
  return useQuery({ queryKey: keys.me, queryFn: () => api<Me>("/me"), enabled });
}

/** 入っているグループを、メンバーと一緒に読む */
export function useGroups() {
  return useQuery({
    queryKey: keys.groups,
    queryFn: () => api<{ groups: GroupSummary[] }>("/groups").then((r) => r.groups),
  });
}

/**
 * 期間のカレンダーの項目を読む。月を移る間は前の項目を出したままにする。
 * @param from 期間の始まり。ミリ秒の UTC
 * @param to 期間の終わり。含まない
 */
export function useCalendar(from: number, to: number) {
  return useQuery({
    queryKey: keys.calendar(from, to),
    queryFn: () => api<{ items: CalendarItem[] }>(`/calendar?from=${from}&to=${to}`).then((r) => r.items),
    placeholderData: (prev) => prev,
  });
}
