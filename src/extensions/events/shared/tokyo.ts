/**
 * 繰り返しの日付を、利用者の時間帯で数える。時間帯を選べる仕組みはまだ無いので、Asia/Tokyo に固定する。0068
 * クライアントの既定の曜日選択と、サーバーの展開(repeat.ts)の両方がここを使う。どちらも同じ日になる。
 *
 * Asia/Tokyo は夏時間が無く、UTC からのずれがいつも 9 時間なので、Intl を使わず時刻の足し引きだけで求める。
 */

const REPEAT_TIME_ZONE = "Asia/Tokyo";
const TOKYO_OFFSET_MS = 9 * 60 * 60 * 1000;

const SHORT_NAME_TO_ISO_WEEKDAY: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

const weekdayFormatter = new Intl.DateTimeFormat("en-US", { timeZone: REPEAT_TIME_ZONE, weekday: "short" });

/**
 * その時刻の、日本時間での曜日。月を 1、日を 7 とした数。0068
 * @param d 予定の始まりなど。ミリ秒の UTC を持つ Date
 */
export function isoWeekdayInTokyo(d: Date): number {
  return SHORT_NAME_TO_ISO_WEEKDAY[weekdayFormatter.format(d)] ?? 1;
}

/** 日本時間での年・月(0 始まり)・日・時刻。Date の UTC の getter と同じ形にそろえる */
export type TokyoFields = {
  year: number;
  month: number;
  date: number;
  hours: number;
  minutes: number;
  seconds: number;
  ms: number;
};

/**
 * その時刻の、日本時間での年・月・日・時刻。0068
 * @param d ミリ秒の UTC を持つ Date
 */
export function tokyoFieldsOf(d: Date): TokyoFields {
  const t = new Date(d.getTime() + TOKYO_OFFSET_MS);
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth(),
    date: t.getUTCDate(),
    hours: t.getUTCHours(),
    minutes: t.getUTCMinutes(),
    seconds: t.getUTCSeconds(),
    ms: t.getUTCMilliseconds(),
  };
}

/**
 * 日本時間の年・月・日・時刻から、UTC のミリ秒を作る。tokyoFieldsOf の逆。0068
 * 月や日が範囲外(13 月、32 日など)でも、Date.UTC と同じく繰り上がる
 */
export function utcFromTokyoFields(f: TokyoFields): number {
  return Date.UTC(f.year, f.month, f.date, f.hours, f.minutes, f.seconds, f.ms) - TOKYO_OFFSET_MS;
}
