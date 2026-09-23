/**
 * カレンダーへ天気の項目を渡す。0008
 *
 * 予報は今日から 7 日分だけ、キャッシュにあるものを返す。取りに行くのは、いつもの場所を保存した
 * 直後と、Cron Triggers の scheduled.ts だけ。ここでは D1 を読むだけにして、月の表を開くたびに
 * Open-Meteo へ問い合わせないようにする。F-403、F-407
 *
 * しおりの 1 日(F-114)は、期間がちょうど 1 日だけの問い合わせで来る。過去の日なら、そのときだけ
 * Open-Meteo の過去の天気を取りに行き、キャッシュへ残す。F-406
 */
import type { CalendarContext } from "@extensions/server/types";
import type { DB } from "@server/core/db/client";
import { groupMembers, groups } from "@server/core/db/schema";
import { enforceRateLimit } from "@server/core/rate-limit";
import type { CalendarItem } from "@shared/api-types";
import { and, eq, inArray } from "drizzle-orm";
import { formatWeatherTitle, weatherIconOf } from "../shared/codes";
import { DAY_MS, dateKeyOfJst, forecastDateKeys, startOfDateJst } from "../shared/dates";
import { getCachedDaily, placeKeyOf, upsertDaily } from "./cache";
import { type DailyWeather, fetchArchiveDay } from "./open-meteo";
import { weatherLocations } from "./schema";

/** カレンダーの月の表に出す予報の日数。F-403 */
export const FORECAST_DAYS = 7;

/** 自分だけのグループの ID。groupIds に含まれず、見えないなら null */
async function myPersonalGroupId(db: DB, groupIds: string[], userId: string): Promise<string | null> {
  const personal = await db
    .select({ id: groups.id })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(and(eq(groupMembers.userId, userId), eq(groups.isPersonal, true), inArray(groups.id, groupIds)))
    .get();
  return personal?.id ?? null;
}

/** 天気をカレンダーの項目の形にする */
function toCalendarItem(
  date: string,
  code: number,
  tempMax: number,
  tempMin: number,
  personalGroupId: string,
  userId: string,
  place: string,
): CalendarItem {
  const start = startOfDateJst(date);
  return {
    extension: "weather",
    id: date,
    groupId: personalGroupId,
    createdBy: userId,
    startsAt: start,
    endsAt: start + DAY_MS,
    allDay: true,
    title: formatWeatherTitle(code, tempMax, tempMin),
    place,
    // 見分けの印は #129(0056)の kind と icon を使う。天気の種類ごとにアイコンを変える
    kind: "record",
    icon: weatherIconOf(code),
    secondary: true,
  };
}

/**
 * キャッシュに無い過去の日を、Open-Meteo の過去の天気から 1 日ずつ取り、キャッシュへ残す。F-406、F-407
 * 1 件取れなくても、ほかの日は続けて試す。読めない日は呼び出し側で諦める。F-409
 *
 * カレンダーを開くたびに呼ばれる道なので、上限に当たっても投げず、その日の天気を諦めるだけにする。
 * ほかの拡張の項目までまとめて壊さないため。0065、#161
 */
async function fetchMissingArchiveDays(
  db: DB,
  location: { latitude: number; longitude: number },
  placeKey: string,
  dates: string[],
  env: Env,
  requestUrl: string,
  userId: string,
): Promise<DailyWeather[]> {
  const results: DailyWeather[] = [];
  for (const date of dates) {
    try {
      await enforceRateLimit(env.WEATHER_RATE_LIMIT, userId);
      const row = await fetchArchiveDay(location, date, env, requestUrl);
      if (!row) continue;
      await upsertDaily(db, placeKey, [row], "archive");
      results.push(row);
    } catch {
      // 取れなかった日は、天気を出さないだけにする。上限に当たったときも同じ。F-409、0065
    }
  }
  return results;
}

/**
 * 期間にかかる天気を返す。いつもの場所を選んだ本人にだけ返す。F-403、F-406、F-409
 * @param groupIds 呼んでよいグループ
 * @param from 期間の始まり
 * @param to 期間の終わり。含まない
 * @param ctx 呼ぶ人。env と requestUrl が無ければ、過去の天気は取りに行かずキャッシュだけで返す
 */
export async function listWeatherItems(
  db: DB,
  groupIds: string[],
  from: number,
  to: number,
  ctx: CalendarContext,
): Promise<CalendarItem[]> {
  if (groupIds.length === 0) return [];
  const personalId = await myPersonalGroupId(db, groupIds, ctx.userId);
  if (!personalId) return [];

  const location = await db.select().from(weatherLocations).where(eq(weatherLocations.userId, ctx.userId)).get();
  if (!location) return [];

  const today = dateKeyOfJst(Date.now());
  const wanted = new Set<string>();
  // 今日から 7 日分の予報のうち、問い合わせの期間に入るものだけ
  for (const date of forecastDateKeys(today, FORECAST_DAYS)) {
    const start = startOfDateJst(date);
    if (start < to && start + DAY_MS > from) wanted.add(date);
  }
  // しおりの 1 日のような、ちょうど 1 日だけの過去の問い合わせなら、その日の過去の天気も対象にする
  if (to - from <= DAY_MS) {
    const date = dateKeyOfJst(from);
    if (date < today) wanted.add(date);
  }
  if (wanted.size === 0) return [];

  const placeKey = placeKeyOf(location.latitude, location.longitude);
  const cached = await getCachedDaily(db, placeKey, [...wanted]);
  const byDate = new Map<string, { code: number; tempMax: number; tempMin: number }>();
  for (const row of cached.values())
    byDate.set(row.date, { code: row.weatherCode, tempMax: row.tempMax, tempMin: row.tempMin });

  const pastMissing = [...wanted].filter((d) => d < today && !byDate.has(d));
  if (pastMissing.length > 0 && ctx.env && ctx.requestUrl) {
    const fetched = await fetchMissingArchiveDays(
      db,
      location,
      placeKey,
      pastMissing,
      ctx.env,
      ctx.requestUrl,
      ctx.userId,
    );
    for (const row of fetched) byDate.set(row.date, { code: row.code, tempMax: row.tempMax, tempMin: row.tempMin });
  }

  return [...wanted]
    .map((date) => {
      const w = byDate.get(date);
      return w ? toCalendarItem(date, w.code, w.tempMax, w.tempMin, personalId, ctx.userId, location.name) : null;
    })
    .filter((item): item is CalendarItem => item != null);
}

/** 天気は文字を探す対象を持たない。0046 */
export async function searchWeather(): Promise<CalendarItem[]> {
  return [];
}
