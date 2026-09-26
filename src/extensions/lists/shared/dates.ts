/**
 * リストの日付の計算。日付は `2026-09-22` の形の文字列で持ち、時刻は持たない。
 * カレンダーへ渡すときだけ、日本時間の 0 時を始まりとする終日の項目に変える。日本は夏時間が無いので、ずれは固定でよい。
 */

/** 日本時間と協定世界時のずれ。ミリ秒 */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 1 日のミリ秒 */
export const DAY_MS = 24 * 60 * 60 * 1000;

/** `2026-09-22` の形の日付の並び。0 から始まる月と違い、そのまま比べられる文字列にする */
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** 文字列が `2026-09-22` の形の日付かどうか */
export function isDateKey(value: string): boolean {
  if (!DATE_KEY.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/**
 * その日の、日本時間での 0 時を協定世界時のミリ秒で返す。
 * @param date `2026-09-22` の形の日付
 */
export function startOfDateJst(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) - JST_OFFSET_MS;
}

/**
 * その時刻の、日本時間での日付を `2026-09-22` の形で返す。
 * @param ms 協定世界時のミリ秒
 */
export function dateKeyOfJst(ms: number): string {
  const d = new Date(ms + JST_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}
