/** ひとコマの読み書き。0022 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
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
