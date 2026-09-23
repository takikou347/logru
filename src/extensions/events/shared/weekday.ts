/**
 * 繰り返しの曜日を、利用者の時間帯で数える。時間帯を選べる仕組みはまだ無いので、Asia/Tokyo に固定する。0068
 * クライアントの既定の曜日選択と、サーバーの展開(repeat.ts)の両方がここを使う。どちらも同じ曜日になる。
 */

const REPEAT_TIME_ZONE = "Asia/Tokyo";

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
