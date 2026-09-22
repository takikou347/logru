/** 予定の拡張の API 呼び出し */
import type { CalendarItem } from "@shared/api-types";
import { api } from "@/api/client";

/** 招待に返事を送る */
export function respondToEvent(id: string, response: "accepted" | "declined") {
  return api<CalendarItem>(`/events/${id}/response`, { method: "PUT", body: { response } });
}

/** 予定を作る。作った予定を返す */
export function createEvent(payload: unknown) {
  return api<CalendarItem>("/events", { method: "POST", body: payload });
}

/** 予定を直す。直した予定を返す */
export function updateEvent(id: string, payload: unknown) {
  return api<CalendarItem>(`/events/${id}`, { method: "PATCH", body: payload });
}

/** 予定を消す */
export function deleteEvent(id: string, opts: { keepalive: boolean }) {
  return api<void>(`/events/${id}`, { method: "DELETE", keepalive: opts.keepalive });
}
