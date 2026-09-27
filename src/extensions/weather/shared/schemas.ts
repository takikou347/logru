import { z } from "zod";

/**
 * いつもの場所を保存するときの入力。市区町村を検索した結果から、そのまま送る。F-401
 * 緯度経度は WGS84 の度。
 */
export const weatherLocationInput = z.object({
  name: z.string().trim().min(1, "場所を選んでください。").max(80, "場所の名前は 80 文字までです。"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type WeatherLocationInput = z.infer<typeof weatherLocationInput>;

/** 市区町村を検索するときの入力。F-401 */
export const weatherSearchQuery = z.object({
  q: z.string().trim().min(1, "探す文字を入れてください。").max(80, "探す文字は 80 文字までです。"),
});
