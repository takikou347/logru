/**
 * Cron Triggers から呼ぶ。まだ今日の予報を取っていない場所だけ、まとめて取り直す。F-403、F-407
 *
 * いつもの場所を保存した直後にも 1 度取るので(routes.ts)、ここは主に日をまたいだときの
 * 取りこぼしを拾う。同じ町を選んだ人が複数いても、場所ごとに 1 度しか取りに行かない。
 */
import type { DB } from "@server/core/db/client";
import { dateKeyOfJst } from "../shared/dates";
import { getCachedDaily, placeKeyOf, upsertDaily } from "./cache";
import { fetchForecast } from "./open-meteo";
import { FORECAST_DAYS } from "./provider";
import { weatherLocations } from "./schema";

/** 1 回の Cron で取り直す場所の数。CPU 時間の上限があるので、少しずつ取る */
const CRON_BATCH = 10;

/** Cron Triggers から呼ばれる。手元の開発では isLocalDev の判定に使う requestUrl が無いため、本物の URL へ問い合わせる */
export async function refreshDueLocations(db: DB, env: Env): Promise<void> {
  const rows = await db.select().from(weatherLocations);
  if (rows.length === 0) return;

  const today = dateKeyOfJst(Date.now());
  // 場所ごとにまとめる。同じ町を選んだ人が複数いても、取りに行くのは 1 度だけ
  const byPlace = new Map<string, { latitude: number; longitude: number }>();
  for (const row of rows) byPlace.set(placeKeyOf(row.latitude, row.longitude), row);

  let checked = 0;
  for (const [placeKey, location] of byPlace) {
    if (checked >= CRON_BATCH) break;
    checked += 1;
    const cached = await getCachedDaily(db, placeKey, [today]);
    if (cached.has(today)) continue;
    try {
      const forecast = await fetchForecast(location, env, "https://logru.invalid/", FORECAST_DAYS);
      await upsertDaily(db, placeKey, forecast, "forecast");
    } catch {
      // 次の Cron でもう一度試す。F-409
    }
  }
}
