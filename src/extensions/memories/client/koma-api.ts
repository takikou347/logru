/** ひとコマの読み書き。0022 */
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { KomaDay, KomaNow } from "../shared/types";

export const komaKeys = { now: ["memories", "koma", "now"] as const, days: ["memories", "koma", "days"] as const };

/** 端末の時間帯 */
export const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tokyo";

/**
 * 今日のひとコマの状態。1 分おきに読み直す。枠が変わったら近道の帯も変わる。
 * @param enabled 思い出の拡張が使えるときだけ true
 */
export function useKomaNow(enabled = true) {
  return useQuery({
    queryKey: komaKeys.now,
    queryFn: () => api<KomaNow>(`/memories/koma/now?tz=${encodeURIComponent(deviceTimeZone())}`),
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/** 自分のひとコマを日ごとに */
export function useKomaDays() {
  return useQuery({ queryKey: komaKeys.days, queryFn: () => api<{ days: KomaDay[] }>("/memories/koma").then((r) => r.days) });
}

/** ある日のひとコマの、共有先と思い出のつなぎを保存する。muted を渡すと通知のオン・オフも変える */
export function useSaveKomaDay() {
  return useMutation({
    mutationFn: ({ day, groupId, memoryId, timeZone, muted }: { day: string; groupId: string; memoryId: string | null; timeZone: string; muted?: boolean }) =>
      api(`/memories/koma/days/${day}`, { method: "PUT", body: { groupId, memoryId, timeZone, ...(muted === undefined ? {} : { muted }) } }),
  });
}

/** いまの枠のひとコマを保存する */
export function useSaveKomaNow() {
  return useMutation({
    mutationFn: ({ photoId, slot, body }: { photoId: string; slot: number; body: string | null }) =>
      api("/memories/koma", { method: "PUT", body: { photoId, slot, body } }),
  });
}
