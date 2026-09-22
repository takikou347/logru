import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import { queryClient } from "@/api/query-client";
import type { ExternalCalendarSummary } from "../shared/schemas";

/** 登録した外部のカレンダーの、読み込みの名前 */
export const EXTERNAL_CALENDARS_KEY = ["external-calendars"] as const;

/** 登録した外部のカレンダーを API から読む */
export function fetchExternalCalendars(): Promise<ExternalCalendarSummary[]> {
  return api<{ calendars: ExternalCalendarSummary[] }>("/external-calendars").then((r) => r.calendars);
}

/** 登録した外部のカレンダーを読む */
export function useExternalCalendars() {
  return useQuery({ queryKey: EXTERNAL_CALENDARS_KEY, queryFn: fetchExternalCalendars });
}

/**
 * カレンダーの「読み直す」で呼ぶ。登録した外部のカレンダーをすべて読み直す。手続き型なので hook にはしない。
 * 1 つも登録していなければ、何もしない。
 * @returns 読めなかったカレンダーの名前
 */
export async function refreshExternalCalendars(): Promise<{ failed: string[] }> {
  const known = await queryClient.fetchQuery({ queryKey: EXTERNAL_CALENDARS_KEY, queryFn: fetchExternalCalendars });
  if (known.length === 0) return { failed: [] };
  const { calendars } = await api<{ calendars: ExternalCalendarSummary[] }>("/external-calendars/sync", { method: "POST" });
  queryClient.setQueryData(EXTERNAL_CALENDARS_KEY, calendars);
  return { failed: calendars.filter((c) => c.lastError).map((c) => c.name) };
}

/** 1 件だけ、いますぐ読み直す */
export function useResyncExternalCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<ExternalCalendarSummary>(`/external-calendars/${id}/sync`, { method: "POST" }),
    onSuccess: (c) => (c.lastError ? toast.error(c.lastError) : toast(`${c.name} を読み直しました`)),
    onError: (e) => toast.error((e as Error).message),
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: EXTERNAL_CALENDARS_KEY }), qc.invalidateQueries({ queryKey: ["calendar"] })]),
  });
}

/** 外部のカレンダーを登録する */
export function useAddExternalCalendar() {
  return useMutation({
    mutationFn: (payload: { name: string; color: string; url: string }) =>
      api<ExternalCalendarSummary>("/external-calendars", { method: "POST", body: payload }),
  });
}

/** 外部のカレンダーの登録を消す */
export function useRemoveExternalCalendar() {
  return useMutation({
    mutationFn: (id: string) => api(`/external-calendars/${id}`, { method: "DELETE" }),
  });
}
