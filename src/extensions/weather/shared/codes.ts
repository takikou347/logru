/**
 * Open-Meteo が返す WMO の天気コードを、日本語の短い言葉に変える。
 * 表は Open-Meteo のドキュメントの「WMO Weather interpretation codes」から。
 */

/** 見た目の分類。天気の中身のシートでアイコンを選ぶのに使う */
export type WeatherCategory = "clear" | "cloudy" | "fog" | "rain" | "snow" | "thunder";

const CODE_TABLE: Record<number, { label: string; category: WeatherCategory }> = {
  0: { label: "快晴", category: "clear" },
  1: { label: "晴れ", category: "clear" },
  2: { label: "薄曇り", category: "cloudy" },
  3: { label: "くもり", category: "cloudy" },
  45: { label: "霧", category: "fog" },
  48: { label: "霧", category: "fog" },
  51: { label: "霧雨", category: "rain" },
  53: { label: "霧雨", category: "rain" },
  55: { label: "霧雨", category: "rain" },
  56: { label: "着氷性の霧雨", category: "rain" },
  57: { label: "着氷性の霧雨", category: "rain" },
  61: { label: "雨", category: "rain" },
  63: { label: "雨", category: "rain" },
  65: { label: "強い雨", category: "rain" },
  66: { label: "着氷性の雨", category: "rain" },
  67: { label: "着氷性の雨", category: "rain" },
  71: { label: "雪", category: "snow" },
  73: { label: "雪", category: "snow" },
  75: { label: "強い雪", category: "snow" },
  77: { label: "細氷", category: "snow" },
  80: { label: "にわか雨", category: "rain" },
  81: { label: "にわか雨", category: "rain" },
  82: { label: "激しいにわか雨", category: "rain" },
  85: { label: "にわか雪", category: "snow" },
  86: { label: "にわか雪", category: "snow" },
  95: { label: "雷雨", category: "thunder" },
  96: { label: "ひょうを伴う雷雨", category: "thunder" },
  99: { label: "ひょうを伴う雷雨", category: "thunder" },
};

/** コードから日本語の短い言葉を返す。知らないコードは「天気」とだけ返す */
export function weatherLabel(code: number): string {
  return CODE_TABLE[code]?.label ?? "天気";
}

/** コードから見た目の分類を返す。知らないコードは cloudy 扱いにする */
export function weatherCategory(code: number): WeatherCategory {
  return CODE_TABLE[code]?.category ?? "cloudy";
}

/**
 * カレンダーの日のマスに出す題名。`晴れ 24°/18°` の形。
 * @param code WMO のコード
 * @param tempMax 最高気温。摂氏
 * @param tempMin 最低気温。摂氏
 */
export function formatWeatherTitle(code: number, tempMax: number, tempMin: number): string {
  return `${weatherLabel(code)} ${Math.round(tempMax)}°/${Math.round(tempMin)}°`;
}
