/**
 * 定期の記録の日付の計算。毎日の定期の処理(server/scheduled.ts)と、入力の確かめ(shared/schemas.ts)で使う。0072、F-325
 */

/** その年月の日数 */
export function daysInMonth(year: number, month: number): number {
  // month は 1〜12。Date の月は 0 始まりなので、そのまま渡した月の 0 日目 = 前の月の末日ではなく、
  // 1 つ先の月として渡した月の 0 日目 = 求めたい月の末日になる
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * その年月で、実際に記録を入れる日。31 日は月末として扱う。F-325
 * @param dayOfMonth 定期の記録が持つ、毎月の日(1〜31)
 */
export function dueDayOfMonth(dayOfMonth: number, year: number, month: number): number {
  return Math.min(dayOfMonth, daysInMonth(year, month));
}

/** `2026-09-24` から `2026-09` を作る */
export function monthKeyOfDate(date: string): string {
  return date.slice(0, 7);
}

/** 定期の記録のうち、有効・無効の判定に要る項目 */
export type RecurringActivity = {
  dayOfMonth: number;
  startMonth: string;
  endMonth: string | null;
  lastMonth: string | null;
  pausedAt: number | null;
};

/**
 * その月に、まだ記録を入れていない、動いている定期の記録かどうか。
 * 実際にその日になったかどうかは呼び出し側が確かめる(effective な日を dueDayOfMonth で求めて比べる)。F-325
 * @param month `2026-09` の形
 */
export function isRecurringActiveInMonth(r: RecurringActivity, month: string): boolean {
  if (r.pausedAt !== null) return false;
  if (month < r.startMonth) return false;
  if (r.endMonth !== null && month > r.endMonth) return false;
  if (r.lastMonth === month) return false;
  return true;
}
