import { QueryClient, useQuery } from "@tanstack/react-query";
import type { CalendarItem, GroupSummary, Me } from "../../shared/api-types";
import { ApiError, api } from "./api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
      refetchOnWindowFocus: true,
    },
  },
});

export const keys = {
  me: ["me"] as const,
  config: ["config"] as const,
  groups: ["groups"] as const,
  calendar: (from: number, to: number) => ["calendar", from, to] as const,
};

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: () => api<Me>("/me") });
}

export function useConfig() {
  return useQuery({
    queryKey: keys.config,
    queryFn: () => api<{ googleEnabled: boolean }>("/config"),
    staleTime: Infinity,
  });
}

export function useGroups() {
  return useQuery({
    queryKey: keys.groups,
    queryFn: () => api<{ groups: GroupSummary[] }>("/groups").then((r) => r.groups),
  });
}

export function useCalendar(from: number, to: number) {
  return useQuery({
    queryKey: keys.calendar(from, to),
    queryFn: () => api<{ items: CalendarItem[] }>(`/calendar?from=${from}&to=${to}`).then((r) => r.items),
    placeholderData: (prev) => prev,
  });
}
