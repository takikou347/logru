/**
 * 思い出の日付の計算。思い出は time_zone での 0 時で区切る。
 * 画面とサーバーの両方で使う。Intl だけを使い、端末の時間帯に頼らない。
 */

/** 記録を日ごとにまとめるときの時間帯。思い出の外の記録には時間帯が無いので、これで数える */
export const DEFAULT_TIME_ZONE = "Asia/Tokyo";

/** 1 日のミリ秒 */
export const DAY_MS = 24 * 60 * 60 * 1000;

/** 思い出の期間の上限。31 日 */
export const MAX_MEMORY_DAYS = 31;

/**
 * その時刻の、その時間帯での日付を `2026-09-22` の形で返す。
 * @param ms ミリ秒の UTC
 * @param timeZone IANA の時間帯の名前
 */
export function dayKeyIn(ms: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(ms);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * その時刻の、その時間帯での時。0 から 23。
 * @param ms ミリ秒の UTC
 * @param timeZone IANA の時間帯の名前
 */
export function hourIn(ms: number, timeZone: string): number {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(ms);
  return Number(h);
}

/**
 * その時間帯での、ある日の 0 時を UTC のミリ秒で返す。夏時間の切り替わりにも合わせる。
 * @param key `2026-09-22` の形の日付
 * @param timeZone IANA の時間帯の名前
 */
export function startOfDayIn(key: string, timeZone: string): number {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  let guess = Date.UTC(y, m - 1, d);
  // 時間帯のずれを 2 回まで詰める。1 回目で大抵合い、2 回目で切り替わりの日を拾う
  for (let i = 0; i < 2; i++) {
    const offset = zoneOffset(guess, timeZone);
    guess = Date.UTC(y, m - 1, d) - offset;
  }
  return guess;
}

/** その時刻での、UTC からのずれ。ミリ秒 */
function zoneOffset(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(ms);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/**
 * 日付に日数を足す。
 * @param key `2026-09-22` の形の日付
 * @param n 足す日数。負でもよい
 */
export function addDaysToKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** 2 つの日付の差。b - a の日数 */
export function daysBetween(a: string, b: string): number {
  const toUtc = (k: string) => {
    const [y, m, d] = k.split("-").map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

/**
 * 思い出の日の一覧。初日から最後の日まで。
 * @param memory 思い出の期間と時間帯
 */
export function memoryDays(memory: { startsAt: number; endsAt: number; timeZone: string }): string[] {
  const first = dayKeyIn(memory.startsAt, memory.timeZone);
  const last = dayKeyIn(memory.endsAt - 1, memory.timeZone);
  const n = Math.max(1, daysBetween(first, last) + 1);
  return Array.from({ length: n }, (_, i) => addDaysToKey(first, i));
}

/**
 * 記録の時刻が思い出の何日目かを返す。期間の外なら、いちばん近い日。0020 の困ること
 * @param ms 記録の時刻
 * @param memory 思い出の期間と時間帯
 */
export function dayIndexOf(ms: number, memory: { startsAt: number; endsAt: number; timeZone: string }): number {
  const days = memoryDays(memory);
  const i = daysBetween(days[0]!, dayKeyIn(ms, memory.timeZone));
  return Math.min(Math.max(i, 0), days.length - 1);
}
