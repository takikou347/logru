/**
 * iCal の文字列を読み、期間に入る予定を 1 回ずつに開いて返す。
 *
 * 繰り返し（RRULE）は ical.js で開き、EXDATE で抜いた回と、RECURRENCE-ID で直した回を反映する。
 * Workers の無料プランは 1 回の CPU 時間が 10 ミリ秒なので、読む期間と件数に上限を置く。
 *
 * VEVENT の数と、繰り返しを開く回数は、どちらも 1 回の読み込み全体で数える。予定が 1 件でも、
 * 予定の数が多くても、重いカレンダー 1 つで CPU 時間を使い切らないようにするため。0065、#161
 */
import ICAL from "ical.js";

/** 時間帯の情報が無いときに使う時間帯。利用者はいま日本にいる */
export const DEFAULT_TIME_ZONE = "Asia/Tokyo";

/** 1 つのカレンダーから持つ予定の上限 */
const MAX_OCCURRENCES = 3000;

/** 1 つの繰り返しを開く回数の上限。期間の前から続く繰り返しも数える */
const MAX_ITERATIONS = 5000;

/** 1 つのカレンダーから読む VEVENT の数の上限。超えた分は読まない。0065、#161 */
const MAX_VEVENTS = 5000;

/**
 * 繰り返しを開く回数の上限。予定の数に関わらず、1 回の読み込み全体で数える。
 * MAX_ITERATIONS は 1 件ごとの上限で、こちらは全体の上限。0065、#161
 */
const MAX_TOTAL_ITERATIONS = 20000;

/** 期間の前の回を飛ばすときの余白。これより長い予定の、期間にかかる部分は取りこぼす */
const SKIP_MARGIN_MS = 31 * 24 * 60 * 60 * 1000;

const TITLE_MAX = 200;
const LOCATION_MAX = 200;

/** 読んだ予定の 1 回分 */
export type ParsedEvent = {
  uid: string;
  /** 繰り返しの何回目か。元の始まりの時刻。ミリ秒の UTC */
  occurrence: number;
  /** 始まり。ミリ秒の UTC。終日なら、その日の 0 時 */
  startsAt: number;
  /** 終わり。含まない。終日なら終わりの日の翌日の 0 時。無ければ null */
  endsAt: number | null;
  allDay: boolean;
  title: string;
  location: string | null;
};

const formatters = new Map<string, Intl.DateTimeFormat | null>();

/** その時間帯の時刻を読む道具。IANA の名前でなければ null */
function formatter(tz: string): Intl.DateTimeFormat | null {
  if (!formatters.has(tz)) {
    try {
      formatters.set(
        tz,
        new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          hourCycle: "h23",
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
        }),
      );
    } catch {
      formatters.set(tz, null);
    }
  }
  return formatters.get(tz)!;
}

const offsetCache = new Map<string, number>();

/**
 * その時間帯の、UTC からのずれ。ミリ秒。
 * Intl で読むのは重いので、時間帯と 15 分の区切りごとに覚えておく。ずれが変わるのは 15 分の区切りだけ
 */
function offsetAt(utcMs: number, f: Intl.DateTimeFormat, tz: string): number {
  const key = `${tz}|${Math.floor(utcMs / 900_000)}`;
  let v = offsetCache.get(key);
  if (v === undefined) {
    if (offsetCache.size > 50_000) offsetCache.clear();
    v = readOffset(utcMs, f);
    offsetCache.set(key, v);
  }
  return v;
}

function readOffset(utcMs: number, f: Intl.DateTimeFormat): number {
  const p: Record<string, number> = {};
  for (const part of f.formatToParts(new Date(utcMs))) if (part.type !== "literal") p[part.type] = Number(part.value);
  const asUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * その時間帯での壁の時計の時刻を、UTC のミリ秒にする。
 * @param tz IANA の時間帯の名前。例は Asia/Tokyo
 * @returns 時間帯を知らなければ null
 */
export function wallTimeToUtc(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  s: number,
  tz: string,
): number | null {
  const f = formatter(tz);
  if (!f) return null;
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const first = guess - offsetAt(guess, f, tz);
  return guess - offsetAt(first, f, tz);
}

/** IANA の時間帯の名前として使えるか */
function isKnownTimeZone(tz: string | null | undefined): tz is string {
  return !!tz && formatter(tz) !== null;
}

/**
 * ical.js の時刻を UTC のミリ秒にする。
 *
 * 終日は calendarTz の 0 時にする。手で足した終日の予定と同じく、その日の 0 時として並べるため。
 * TZID が IANA の名前なら Intl で直す。そうでなく、VTIMEZONE で時間帯が分かれば ical.js で直す。
 * どれでもなければ、時間帯の無い時刻として calendarTz で読む。
 *
 * @param tzid その時刻の TZID。プロパティから読んだもの
 * @param calendarTz カレンダーの時間帯。X-WR-TIMEZONE か、無ければ Asia/Tokyo
 */
function toUtcMs(time: ICAL.Time, tzid: string | null, calendarTz: string): number {
  const wall = (tz: string) => wallTimeToUtc(time.year, time.month, time.day, time.hour, time.minute, time.second, tz);
  if (time.isDate) return wallTimeToUtc(time.year, time.month, time.day, 0, 0, 0, calendarTz)!;
  if (time.zone?.tzid === "UTC") return time.toUnixTime() * 1000;
  if (tzid && isKnownTimeZone(tzid)) return wall(tzid)!;
  if (tzid && time.zone && time.zone !== ICAL.Timezone.localTimezone) return time.toUnixTime() * 1000;
  return wall(calendarTz)!;
}

/** プロパティの TZID を読む */
function tzidOf(event: ICAL.Event, name: "dtstart" | "dtend"): string | null {
  const v = event.component.getFirstProperty(name)?.getParameter("tzid");
  return typeof v === "string" ? v : null;
}

function clip(text: string | null | undefined, max: number): string | null {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
}

/** 1 回分を返す形にする。終わりが無ければ、終日は 1 日、それ以外は null */
function toParsed(
  item: ICAL.Event,
  start: ICAL.Time,
  end: ICAL.Time | null,
  occurrence: number,
  calendarTz: string,
): ParsedEvent {
  const allDay = start.isDate;
  const startsAt = toUtcMs(start, tzidOf(item, "dtstart"), calendarTz);
  let endsAt: number | null = end ? toUtcMs(end, tzidOf(item, "dtend") ?? tzidOf(item, "dtstart"), calendarTz) : null;
  if (allDay && (endsAt == null || endsAt <= startsAt)) {
    const next = start.clone();
    next.day += 1;
    endsAt = toUtcMs(next, null, calendarTz);
  }
  if (!allDay && endsAt != null && endsAt <= startsAt) endsAt = null;
  return {
    uid: item.uid,
    occurrence,
    startsAt,
    endsAt,
    allDay,
    title: clip(item.summary, TITLE_MAX) ?? "（題名なし）",
    location: clip(item.location, LOCATION_MAX),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 何年も前から続く毎日と毎週の繰り返しは、1 回ずつ数えると CPU 時間がかかる。
 * 回数の決まっていない（COUNT の無い）ものに限り、始まりを周期の倍数だけ先へ進めてから開く。
 * 周期の倍数なので、進めた後の回は元と同じになる。進めた始まりが規則に合わなくても、期間より前なので捨てられる。
 *
 * @param before この時刻より前までは進めてよい
 * @returns 進めた始まり。進めないなら undefined
 */
function fastForwardStart(event: ICAL.Event, before: number, calendarTz: string): ICAL.Time | undefined {
  const rules = event.component.getAllProperties("rrule");
  if (rules.length !== 1) return undefined;
  const rule = rules[0]!.getFirstValue() as ICAL.Recur;
  if (rule.count || (rule.freq !== "DAILY" && rule.freq !== "WEEKLY")) return undefined;
  const periodDays = (rule.freq === "DAILY" ? 1 : 7) * (rule.interval || 1);
  const start = toUtcMs(event.startDate, tzidOf(event, "dtstart"), calendarTz);
  const periods = Math.floor((before - start) / (periodDays * DAY_MS));
  if (periods <= 0) return undefined;
  const moved = event.startDate.clone();
  moved.adjust(periods * periodDays, 0, 0, 0);
  return moved;
}

const cancelled = (e: ICAL.Event) =>
  String(e.component.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED";

/**
 * iCal の文字列を読み、期間にかかる予定を返す。取り消された予定は除く。
 * @param text iCal の文字列
 * @param window 読む期間。ミリ秒の UTC。to は含まない
 * @throws iCal として読めないとき
 */
export function parseIcs(text: string, window: { from: number; to: number }): ParsedEvent[] {
  const root = new ICAL.Component(ICAL.parse(text));
  if (root.name !== "vcalendar") throw new Error("iCal の形ではありません。");
  // VTIMEZONE は登録しない。ical.js の TimezoneService は Worker の実行環境全体で共有される
  // モジュールの状態なので、登録すると、ほかの人のカレンダーの読み込みにも残ってしまう。
  // IANA の名前は Intl で直に読めるので、ここでは要らない。0065、#161
  const xTz = root.getFirstPropertyValue("x-wr-timezone");
  const calendarTz = typeof xTz === "string" && isKnownTimeZone(xTz) ? xTz : DEFAULT_TIME_ZONE;

  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Event[] = [];
  let veventCount = 0;
  for (const vevent of root.getAllSubcomponents("vevent")) {
    if (veventCount >= MAX_VEVENTS) break;
    veventCount += 1;
    const event = new ICAL.Event(vevent);
    if (!event.uid || !event.startDate) continue;
    if (event.isRecurrenceException()) exceptions.push(event);
    else masters.set(event.uid, event);
  }
  const orphans: ICAL.Event[] = [];
  for (const ex of exceptions) {
    const master = masters.get(ex.uid);
    if (master?.isRecurring()) master.relateException(ex);
    else orphans.push(ex);
  }

  const out: ParsedEvent[] = [];
  const inWindow = (e: ParsedEvent) => e.startsAt < window.to && (e.endsAt ?? e.startsAt + 1) > window.from;
  const push = (e: ParsedEvent) => {
    if (out.length < MAX_OCCURRENCES && inWindow(e)) out.push(e);
  };

  // 繰り返しを開いた回数。予定 1 件ごとではなく、このカレンダー全体で数える。0065、#161
  let totalIterations = 0;
  for (const event of [...masters.values(), ...orphans]) {
    if (out.length >= MAX_OCCURRENCES || totalIterations >= MAX_TOTAL_ITERATIONS) break;
    if (!event.isRecurring() || event.isRecurrenceException()) {
      if (cancelled(event)) continue;
      const occ = event.recurrenceId ?? event.startDate;
      push(
        toParsed(
          event,
          event.startDate,
          event.endDate ?? null,
          toUtcMs(occ, tzidOf(event, "dtstart"), calendarTz),
          calendarTz,
        ),
      );
      continue;
    }
    const it = event.iterator(fastForwardStart(event, window.from - SKIP_MARGIN_MS, calendarTz));
    for (let i = 0; i < MAX_ITERATIONS && out.length < MAX_OCCURRENCES && totalIterations < MAX_TOTAL_ITERATIONS; i++) {
      totalIterations += 1;
      const next = it.next();
      if (!next) break;
      const occurrence = toUtcMs(next, tzidOf(event, "dtstart"), calendarTz);
      // 繰り返しの回が期間の後ろに出たら終わる。直した回が期間の中へ動いた場合は取りこぼすが、まれなので許す
      if (occurrence >= window.to) break;
      // 期間よりずっと前の回は、中身を読まずに飛ばす。長い予定と、直して動いた回のために余白を置く
      if (occurrence < window.from - SKIP_MARGIN_MS) continue;
      const details = event.getOccurrenceDetails(next);
      if (cancelled(details.item)) continue;
      push(toParsed(details.item, details.startDate, details.endDate ?? null, occurrence, calendarTz));
    }
  }
  return out;
}
