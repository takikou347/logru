/** 天気の拡張が API から読むデータと、書き換え */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

/** いつもの場所 */
export type WeatherLocation = { name: string; latitude: number; longitude: number };

/** 市区町村を検索した候補 */
export type WeatherPlace = {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
};

const weatherKeys = {
  location: ["weather", "location"] as const,
  search: (q: string) => ["weather", "search", q] as const,
};

/** いま選んでいる、いつもの場所。まだ選んでいなければ null。F-401 */
export function useWeatherLocation() {
  return useQuery({
    queryKey: weatherKeys.location,
    queryFn: () => api<{ location: WeatherLocation | null }>("/weather/location").then((r) => r.location),
  });
}

/**
 * 市区町村を検索する。F-401
 * @param query 検索の文字。前後の空白を除いて空なら呼ばない
 */
export function useSearchPlaces(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: weatherKeys.search(q),
    queryFn: () =>
      api<{ results: WeatherPlace[] }>(`/weather/search?q=${encodeURIComponent(q)}`).then((r) => r.results),
    enabled: q.length > 0,
  });
}

/** いつもの場所を保存する、入れ替える。F-401、F-402 */
export function useSaveWeatherLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (place: WeatherPlace) =>
      api<WeatherLocation>("/weather/location", {
        method: "POST",
        body: { name: place.name, latitude: place.latitude, longitude: place.longitude },
      }),
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: weatherKeys.location }),
        qc.invalidateQueries({ queryKey: ["calendar"] }),
      ]),
  });
}

/** いつもの場所を消す。F-402 */
export function useDeleteWeatherLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api("/weather/location", { method: "DELETE" }),
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: weatherKeys.location }),
        qc.invalidateQueries({ queryKey: ["calendar"] }),
      ]),
  });
}
