/**
 * Open-Meteo への問い合わせ。0055、F-408
 *
 * 手元の開発と E2E では、本物の Open-Meteo ではなく、この拡張が自分で配る `__test__` の道へ向ける。
 * isLocalDev と同じ判定を使い、要求の出どころで切り替える。
 */

import { isLocalDev } from "@server/core/app";

const REAL_GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const REAL_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const REAL_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";

/** 読むのを待つ時間 */
const FETCH_TIMEOUT_MS = 10_000;

/** 画面にそのまま出せる、Open-Meteo から読めなかった理由 */
export class WeatherFetchError extends Error {}

/** 1 日分の天気 */
export type DailyWeather = { date: string; code: number; tempMax: number; tempMin: number };

/** 市区町村を検索した結果 */
export type PlaceResult = {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
};

/**
 * 呼ぶ URL の元を決める。手元の開発と E2E だけ、自分自身の見本の道へ向け直す。
 * @param kind geocode、forecast、archive のどれを呼ぶか
 * @param real 本物の Open-Meteo の URL
 */
function baseUrl(kind: "geocode" | "forecast" | "archive", env: Env, requestUrl: string, real: string): string {
  if (isLocalDev(env, requestUrl)) return `${new URL(requestUrl).origin}/api/weather/__test__/${kind}`;
  return real;
}

/** URL を読み、JSON にする。つながらない、遅い、形が違うときは WeatherFetchError */
async function fetchJson(url: URL, fetcher: typeof fetch): Promise<unknown> {
  let res: Response;
  try {
    res = await fetcher(url.toString(), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch {
    throw new WeatherFetchError("Open-Meteo につながりませんでした。");
  }
  if (!res.ok) throw new WeatherFetchError(`Open-Meteo が読めませんでした(${res.status})。`);
  try {
    return await res.json();
  } catch {
    throw new WeatherFetchError("Open-Meteo の応答を読めませんでした。");
  }
}

type OpenMeteoDaily = {
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
  };
};

/** 予報、過去の天気、どちらも同じ `daily` の形で返る。日ごとの並びに開く */
export function parseDailyResponse(json: unknown): DailyWeather[] {
  const daily = (json as OpenMeteoDaily).daily;
  if (!daily?.time) return [];
  return daily.time.map((date, i) => ({
    date,
    code: daily.weather_code?.[i] ?? 0,
    tempMax: daily.temperature_2m_max?.[i] ?? 0,
    tempMin: daily.temperature_2m_min?.[i] ?? 0,
  }));
}

type OpenMeteoGeocode = {
  results?: Array<{ id: number; name: string; admin1?: string; country?: string; latitude: number; longitude: number }>;
};

/** 見つからないと `results` が無い応答になる。空の配列にそろえる */
export function parseGeocodeResponse(json: unknown): PlaceResult[] {
  const results = (json as OpenMeteoGeocode).results;
  if (!results) return [];
  return results.map((r) => ({
    id: r.id,
    name: r.name,
    admin1: r.admin1,
    country: r.country,
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

/**
 * 市区町村を検索する。F-401
 * @param query 検索の文字。前後の空白は呼ぶ側で削る
 */
export async function fetchGeocode(
  query: string,
  env: Env,
  requestUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<PlaceResult[]> {
  const url = new URL(baseUrl("geocode", env, requestUrl, REAL_GEOCODE_URL));
  url.searchParams.set("name", query);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "ja");
  url.searchParams.set("format", "json");
  return parseGeocodeResponse(await fetchJson(url, fetcher));
}

/**
 * 今日から数えた予報を取る。日付の並びは日本時間にそろえる。F-403
 * @param days 取る日数
 */
export async function fetchForecast(
  location: { latitude: number; longitude: number },
  env: Env,
  requestUrl: string,
  days: number,
  fetcher: typeof fetch = fetch,
): Promise<DailyWeather[]> {
  const url = new URL(baseUrl("forecast", env, requestUrl, REAL_FORECAST_URL));
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min");
  url.searchParams.set("forecast_days", String(days));
  url.searchParams.set("timezone", "Asia/Tokyo");
  return parseDailyResponse(await fetchJson(url, fetcher));
}

/**
 * 過去の 1 日の天気を取る。しおりの 1 日が求める過去の日に使う。F-406
 * @param date `2026-09-22` の形の日付
 */
export async function fetchArchiveDay(
  location: { latitude: number; longitude: number },
  date: string,
  env: Env,
  requestUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<DailyWeather | null> {
  const url = new URL(baseUrl("archive", env, requestUrl, REAL_ARCHIVE_URL));
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("start_date", date);
  url.searchParams.set("end_date", date);
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min");
  url.searchParams.set("timezone", "Asia/Tokyo");
  const rows = parseDailyResponse(await fetchJson(url, fetcher));
  return rows[0] ?? null;
}
