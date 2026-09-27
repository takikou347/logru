/** 予定の拡張の API 呼び出し */
import type { ItemEditScope } from "@extensions/client/types";
import type { CalendarItem } from "@shared/api-types";
import { api } from "@/api/client";

/** 予定に関する API のこの回だけ・これ以降・全部の範囲。0043 */
type ScopedOpts = { occurrenceAt?: number; scope?: ItemEditScope };

/** 招待に返事を送る */
export function respondToEvent(id: string, response: "accepted" | "declined") {
  return api<CalendarItem>(`/events/${id}/response`, { method: "PUT", body: { response } });
}

/** 予定を作る。作った予定を返す */
export function createEvent(payload: unknown) {
  return api<CalendarItem>("/events", { method: "POST", body: payload });
}

/**
 * 予定を直す。直した予定を返す。
 * 繰り返す予定では opts に occurrenceAt と scope が要る。following は新しい予定を返す。0043
 */
export function updateEvent(id: string, payload: Record<string, unknown>, opts: ScopedOpts = {}) {
  return api<CalendarItem>(`/events/${id}`, { method: "PATCH", body: { ...payload, ...opts } });
}

/** 予定を消す。繰り返す予定では opts に occurrenceAt と scope が要る。0043 */
export function deleteEvent(id: string, opts: ScopedOpts & { keepalive: boolean }) {
  return api<void>(`/events/${id}`, {
    method: "DELETE",
    body: { occurrenceAt: opts.occurrenceAt, scope: opts.scope },
    keepalive: opts.keepalive,
  });
}

/** 予定を 1 件読む。お知らせを押して開くときに使う。#32 */
export function loadEvent(id: string) {
  return api<CalendarItem>(`/events/${id}`);
}
