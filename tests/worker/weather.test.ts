import { missingDates, placeKeyOf } from "@extensions/weather/server/cache";
import { parseDailyResponse, parseGeocodeResponse, WeatherFetchError } from "@extensions/weather/server/open-meteo";
import { formatWeatherTitle, weatherCategory, weatherLabel } from "@extensions/weather/shared/codes";
import {
  addDays,
  DAY_MS,
  dateKeyOfJst,
  forecastDateKeys,
  isDateKey,
  startOfDateJst,
} from "@extensions/weather/shared/dates";
import { weatherLocationInput, weatherSearchQuery } from "@extensions/weather/shared/schemas";
import { describe, expect, it, vi } from "vitest";

describe("天気の日付", () => {
  it("`2026-09-22` の形だけを日付として通す", () => {
    expect(isDateKey("2026-09-22")).toBe(true);
    expect(isDateKey("2026-9-22")).toBe(false);
    expect(isDateKey("2026-02-30")).toBe(false);
  });

  it("日本時間の 0 時を協定世界時で返す", () => {
    expect(new Date(startOfDateJst("2026-09-22")).toISOString()).toBe("2026-09-21T15:00:00.000Z");
  });

  it("協定世界時から、日本時間の日付を読む", () => {
    expect(dateKeyOfJst(Date.parse("2026-09-21T15:00:00Z"))).toBe("2026-09-22");
    expect(dateKeyOfJst(Date.parse("2026-09-21T14:59:59Z"))).toBe("2026-09-21");
  });

  it("日数を足し引きできる。年をまたいでも正しい", () => {
    expect(addDays("2026-09-22", 1)).toBe("2026-09-23");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-09-22", -1)).toBe("2026-09-21");
  });

  it("今日から数えた予報の日付の並びを返す。F-403", () => {
    expect(forecastDateKeys("2026-09-22", 7)).toEqual([
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
      "2026-09-28",
    ]);
  });

  it("1 日はちょうど 24 時間", () => {
    expect(DAY_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe("WMO の天気コード", () => {
  it("知っているコードを日本語の言葉にする", () => {
    expect(weatherLabel(0)).toBe("快晴");
    expect(weatherLabel(61)).toBe("雨");
    expect(weatherLabel(95)).toBe("雷雨");
  });

  it("知らないコードは「天気」とだけ返す", () => {
    expect(weatherLabel(999)).toBe("天気");
  });

  it("見た目の分類を返す", () => {
    expect(weatherCategory(0)).toBe("clear");
    expect(weatherCategory(61)).toBe("rain");
    expect(weatherCategory(71)).toBe("snow");
    expect(weatherCategory(95)).toBe("thunder");
  });

  it("カレンダーの日のマスに出す題名を、天気と最高最低気温をまとめて作る", () => {
    expect(formatWeatherTitle(0, 24.4, 18.6)).toBe("快晴 24°/19°");
    expect(formatWeatherTitle(61, 22, 18)).toBe("雨 22°/18°");
  });
});

describe("いつもの場所の入力。F-401", () => {
  const base = { name: "渋谷区", latitude: 35.66, longitude: 139.7 };

  it("名前と緯度経度がそろえば通す", () => {
    expect(weatherLocationInput.safeParse(base).success).toBe(true);
  });

  it("名前が空、緯度経度が範囲の外なら断る", () => {
    expect(weatherLocationInput.safeParse({ ...base, name: "" }).success).toBe(false);
    expect(weatherLocationInput.safeParse({ ...base, latitude: 91 }).success).toBe(false);
    expect(weatherLocationInput.safeParse({ ...base, longitude: -181 }).success).toBe(false);
  });

  it("検索の文字は空なら断る", () => {
    expect(weatherSearchQuery.safeParse({ q: "渋谷" }).success).toBe(true);
    expect(weatherSearchQuery.safeParse({ q: "" }).success).toBe(false);
    expect(weatherSearchQuery.safeParse({ q: "  " }).success).toBe(false);
  });
});

describe("天気のキャッシュ。F-407", () => {
  it("緯度経度を小数点 2 桁に丸めて、場所の印にする", () => {
    expect(placeKeyOf(35.6617123, 139.7041456)).toBe("35.66,139.70");
    // 同じ町を指す近い座標は、同じ印になる
    expect(placeKeyOf(35.6618, 139.7042)).toBe(placeKeyOf(35.6617, 139.7041));
  });

  it("キャッシュに無い日付だけを返す。同じ場所と日は二度と取りに行かない", () => {
    expect(missingDates(["2026-09-22", "2026-09-23"], ["2026-09-22", "2026-09-23", "2026-09-24"])).toEqual([
      "2026-09-24",
    ]);
    expect(missingDates(["2026-09-22"], ["2026-09-22"])).toEqual([]);
    expect(missingDates([], ["2026-09-22"])).toEqual(["2026-09-22"]);
  });
});

describe("Open-Meteo の応答を読む", () => {
  it("予報と過去の天気は同じ `daily` の形。日ごとの並びに開く", () => {
    const json = {
      daily: {
        time: ["2026-09-22", "2026-09-23"],
        weather_code: [0, 61],
        temperature_2m_max: [24.4, 20.1],
        temperature_2m_min: [18.6, 16.2],
      },
    };
    expect(parseDailyResponse(json)).toEqual([
      { date: "2026-09-22", code: 0, tempMax: 24.4, tempMin: 18.6 },
      { date: "2026-09-23", code: 61, tempMax: 20.1, tempMin: 16.2 },
    ]);
  });

  it("`daily` が無ければ空の配列にする", () => {
    expect(parseDailyResponse({})).toEqual([]);
  });

  it("市区町村の検索結果を開く", () => {
    const json = {
      results: [{ id: 1, name: "渋谷", latitude: 35.66, longitude: 139.7, country: "日本", admin1: "東京都" }],
    };
    expect(parseGeocodeResponse(json)).toEqual([
      { id: 1, name: "渋谷", admin1: "東京都", country: "日本", latitude: 35.66, longitude: 139.7 },
    ]);
  });

  it("見つからないと `results` が無い応答になる。空の配列にそろえる", () => {
    expect(parseGeocodeResponse({})).toEqual([]);
  });
});

describe("Open-Meteo への問い合わせ。応答を差し替えて確かめる", () => {
  const env = { ENVIRONMENT: "production" } as Env;
  const requestUrl = "https://logru.example/api/weather/search";

  it("差し替えた応答から、予報を読む", async () => {
    const { fetchForecast } = await import("@extensions/weather/server/open-meteo");
    const fetcher = vi.fn(
      async (_url: string) =>
        new Response(
          JSON.stringify({
            daily: {
              time: ["2026-09-22"],
              weather_code: [3],
              temperature_2m_max: [23],
              temperature_2m_min: [17],
            },
          }),
        ),
    );
    const rows = await fetchForecast({ latitude: 35.66, longitude: 139.7 }, env, requestUrl, 7, fetcher as never);
    expect(rows).toEqual([{ date: "2026-09-22", code: 3, tempMax: 23, tempMin: 17 }]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const calledUrl = new URL(fetcher.mock.calls[0]![0]);
    expect(calledUrl.hostname).toBe("api.open-meteo.com");
    expect(calledUrl.searchParams.get("forecast_days")).toBe("7");
  });

  it("届かないときは WeatherFetchError にする", async () => {
    const { fetchGeocode } = await import("@extensions/weather/server/open-meteo");
    const fetcher = vi.fn(async () => {
      throw new Error("network down");
    });
    await expect(fetchGeocode("渋谷", env, requestUrl, fetcher as never)).rejects.toBeInstanceOf(WeatherFetchError);
  });
});
