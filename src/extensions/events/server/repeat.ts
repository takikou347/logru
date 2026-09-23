/**
 * 予定の繰り返しを開く。決まった 4 種類(毎日・毎週・毎月・毎年)だけを持ち、RRULE のような書式は使わない。0043
 *
 * 利用者の時間帯は持たないので、UTC の暦で日付・曜日を数える。端末の時間帯と暦がずれる利用者では、
 * 深夜をまたぐ予定の回が 1 日ずれることがある。既存の全部の日付計算と同じ、この拡張の中だけの制約。
 */

/** 繰り返しの周期 */
export type RepeatFreq = "daily" | "weekly" | "monthly" | "yearly";

/** 繰り返しの規則。events の repeat_* の列と対応する */
export type RepeatRule = {
  freq: RepeatFreq;
  /** weekly だけで使う。月を 1、日を 7 とした数。空なら始まりの日の曜日を使う */
  daysOfWeek: number[] | null;
  /** 終わりの日。repeat_count と同時には入らない */
  until: Date | null;
  /** 終わりの回数。repeat_until と同時には入らない */
  count: number | null;
};

/** repeat_freq が空なら繰り返さない予定なので null を返す */
export function repeatRuleOf(row: {
  repeatFreq: RepeatFreq | null;
  repeatDaysOfWeek: number[] | null;
  repeatUntil: Date | null;
  repeatCount: number | null;
}): RepeatRule | null {
  if (!row.repeatFreq) return null;
  return { freq: row.repeatFreq, daysOfWeek: row.repeatDaysOfWeek, until: row.repeatUntil, count: row.repeatCount };
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/** 果てしなく回るのを防ぐ安全弁。実際の終わりはもっと早く来る */
const SAFETY_MAX = 10_000;

/** UTC の曜日。月を 1、日を 7 とした数 */
function isoWeekday(d: Date): number {
  const w = d.getUTCDay();
  return w === 0 ? 7 : w;
}

/** n か月後の同じ日。その月に無ければ null(例: 2 月 31 日は無い) */
function addMonthsUtc(base: Date, n: number): Date | null {
  const wantMonth = (((base.getUTCMonth() + n) % 12) + 12) % 12;
  const target = new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth() + n,
      base.getUTCDate(),
      base.getUTCHours(),
      base.getUTCMinutes(),
      base.getUTCSeconds(),
      base.getUTCMilliseconds(),
    ),
  );
  return target.getUTCMonth() === wantMonth ? target : null;
}

/** n 年後の同じ月日。無ければ null(例: 2 月 29 日で、その年がうるう年でない) */
function addYearsUtc(base: Date, n: number): Date | null {
  const target = new Date(
    Date.UTC(
      base.getUTCFullYear() + n,
      base.getUTCMonth(),
      base.getUTCDate(),
      base.getUTCHours(),
      base.getUTCMinutes(),
      base.getUTCSeconds(),
      base.getUTCMilliseconds(),
    ),
  );
  return target.getUTCMonth() === base.getUTCMonth() ? target : null;
}

/** その日の UTC の終わり(23:59:59.999) */
function endOfUtcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999);
}

/** UTC のその日の 0 時の、1 日前 */
export function dayBeforeUtc(ms: number): Date {
  const d = new Date(ms);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - 1));
}

/** 規則どおりの回の始まりを、早い順に返す。無い月・年はその回を飛ばす */
function* occurrenceDates(startsAt: Date, rule: RepeatRule): Generator<Date> {
  if (rule.freq === "daily") {
    for (let n = 0; ; n++) yield new Date(startsAt.getTime() + n * DAY_MS);
  } else if (rule.freq === "weekly") {
    const days = (rule.daysOfWeek?.length ? [...rule.daysOfWeek] : [isoWeekday(startsAt)]).sort((a, b) => a - b);
    const pointers = days.map((d) => startsAt.getTime() + ((d - isoWeekday(startsAt) + 7) % 7) * DAY_MS);
    while (true) {
      let idx = 0;
      for (let i = 1; i < pointers.length; i++) if (pointers[i]! < pointers[idx]!) idx = i;
      yield new Date(pointers[idx]!);
      pointers[idx] = pointers[idx]! + 7 * DAY_MS;
    }
  } else if (rule.freq === "monthly") {
    for (let n = 0; ; n++) {
      const d = addMonthsUtc(startsAt, n);
      if (d) yield d;
    }
  } else {
    for (let n = 0; ; n++) {
      const d = addYearsUtc(startsAt, n);
      if (d) yield d;
    }
  }
}

/** until・count で打ち切った、回の始まり(ミリ秒)を早い順に返す */
function* boundedOccurrences(startsAt: Date, rule: RepeatRule): Generator<number> {
  const untilEnd = rule.until ? endOfUtcDay(rule.until) : null;
  let count = 0;
  let guard = 0;
  for (const d of occurrenceDates(startsAt, rule)) {
    if (++guard > SAFETY_MAX) return;
    const t = d.getTime();
    if (untilEnd !== null && t > untilEnd) return;
    count++;
    if (rule.count !== null && count > rule.count) return;
    yield t;
  }
}

/**
 * 期間 [from, to) に入る回の始まり(ミリ秒)を、早い順に返す。
 * @param startsAt 予定の始まり。回の時刻はここと同じ
 * @param rule 繰り返しの規則
 * @param from 期間の始まり
 * @param to 期間の終わり。含まない
 */
export function expandOccurrences(startsAt: Date, rule: RepeatRule, from: number, to: number): number[] {
  const out: number[] = [];
  for (const t of boundedOccurrences(startsAt, rule)) {
    if (t >= to) break;
    if (t >= from) out.push(t);
  }
  return out;
}

/**
 * from 以降でいちばん早い回の始まりを返す。もう終わっていれば null。
 * @param startsAt 予定の始まり
 * @param rule 繰り返しの規則
 * @param from この時刻以降で探す
 */
export function nextOccurrenceOnOrAfter(startsAt: Date, rule: RepeatRule, from: number): number | null {
  for (const t of boundedOccurrences(startsAt, rule)) {
    if (t >= from) return t;
  }
  return null;
}
