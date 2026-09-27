/**
 * Open-Meteo の応答の見本。手元の開発と E2E だけで使う。routes.ts の `__test__` の道が配る。
 * 本物の Open-Meteo の JSON と同じ形にそろえ、差し替えても呼ぶ側のコードが変わらないようにする。
 */
import { dateKeyOfJst, forecastDateKeys } from "../shared/dates";

/** 市区町村を検索した見本。押す先が要るだけなので、決まった 2 件を返す */
export function geocodeFixture() {
  return {
    results: [
      { id: 1, name: "渋谷区", latitude: 35.6617, longitude: 139.7041, country: "日本", admin1: "東京都" },
      { id: 2, name: "新宿区", latitude: 35.6938, longitude: 139.7036, country: "日本", admin1: "東京都" },
    ],
  };
}

/** 今日から 7 日分。日ごとに違うコードにして、見分けが付くようにする */
const FORECAST_CODES = [1, 3, 61, 0, 2, 80, 95];
const FORECAST_MAX = [24, 23, 20, 26, 22, 19, 21];
const FORECAST_MIN = [18, 17, 16, 19, 17, 15, 16];

/** 予報の見本。日付は、これを呼んだ時点の今日から数える */
export function forecastFixture() {
  const dates = forecastDateKeys(dateKeyOfJst(Date.now()), FORECAST_CODES.length);
  return {
    daily: {
      time: dates,
      weather_code: FORECAST_CODES,
      temperature_2m_max: FORECAST_MAX,
      temperature_2m_min: FORECAST_MIN,
    },
  };
}

/** 過去の天気の見本。予報と見分けが付くよう、違うコードにする */
export function archiveFixture(date: string) {
  const d = date || dateKeyOfJst(Date.now());
  return {
    daily: { time: [d], weather_code: [63], temperature_2m_max: [22], temperature_2m_min: [18] },
  };
}
