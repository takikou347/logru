import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
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
