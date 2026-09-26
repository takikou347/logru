/** 天気のキャッシュ。場所と日ごとに D1 へ残し、同じ場所と日を二度と取りに行かない。F-407 */

import type { DB } from "@server/core/db/client";
import { and, eq, inArray } from "drizzle-orm";
import type { DailyWeather } from "./open-meteo";
import { type WeatherDailyRow, weatherDaily } from "./schema";

/**
 * 緯度経度から、キャッシュを共有する場所の印を作る。小数点 2 桁に丸め、同じ町どうしで 1 行にする。
 */
export function placeKeyOf(latitude: number, longitude: number): string {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
}

/** 求める日付のうち、キャッシュに無いものだけを返す */
export function missingDates(cached: Iterable<string>, wanted: string[]): string[] {
  const have = new Set(cached);
  return wanted.filter((d) => !have.has(d));
}

/**
 * ある場所の、指定した日付のキャッシュを読む。
 * @returns 日付をキーにした行
 */
export async function getCachedDaily(db: DB, placeKey: string, dates: string[]): Promise<Map<string, WeatherDailyRow>> {
  if (dates.length === 0) return new Map();
  const rows = await db
    .select()
    .from(weatherDaily)
    .where(and(eq(weatherDaily.placeKey, placeKey), inArray(weatherDaily.date, dates)));
  return new Map(rows.map((r) => [r.date, r]));
}

/**
 * 天気を場所ごとにキャッシュへ書く。同じ場所と日はすでにあれば置き換える。
 * @param source forecast か archive
 */
export async function upsertDaily(
  db: DB,
  placeKey: string,
  rows: DailyWeather[],
  source: "forecast" | "archive",
): Promise<void> {
  if (rows.length === 0) return;
  for (const row of rows) {
    await db
      .insert(weatherDaily)
      .values({
        placeKey,
        date: row.date,
        weatherCode: row.code,
        tempMax: row.tempMax,
        tempMin: row.tempMin,
        source,
      })
      .onConflictDoUpdate({
        target: [weatherDaily.placeKey, weatherDaily.date],
        set: { weatherCode: row.code, tempMax: row.tempMax, tempMin: row.tempMin, source },
      });
  }
}
