import { api } from "@/lib/api";
import { queryClient } from "@/lib/queries";
import type { ExternalCalendarSummary } from "../shared/schemas";
import { EXTERNAL_CALENDARS_KEY, fetchExternalCalendars } from "./queries";

/**
 * カレンダーの「読み直す」で呼ぶ。登録した外部のカレンダーをすべて読み直す。
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
