/**
 * 日付の計算。すべて端末の時間帯で数える。API には、ここで作ったミリ秒の UTC を渡す。
 * カレンダーは日曜始まり。祝日は @holiday-jp/holiday_jp の表を使う。
 */
import holidayJp from "@holiday-jp/holiday_jp";

/** 1 日のミリ秒 */
export const DAY_MS = 24 * 60 * 60 * 1000;
/** 日曜から始まる曜日の名前 */
export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** その日の 0 時 */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** n 日後。夏時間が無い前提で、日付の数字だけを動かす */
export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** n か月後。移った月に同じ日が無ければ、その月の末日にそろえる */
export function addMonths(d: Date, n: number): Date {
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last));
}

/** 同じ日か */
export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** `2026-09-21` の形にする。URL と祝日の表に使う */
export function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** `2026-09-21` の形を読む。形が違えば null */
export function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 日曜始まりで、その月を含む週をすべて並べる。5 週か 6 週になる */
export function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const end = addDays(last, 6 - last.getDay());
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

/** その日を含む週の、日曜から土曜 */
export function weekDays(d: Date): Date[] {
  const start = addDays(startOfDay(d), -d.getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** 祝日の名前。祝日でなければ null */
export function holidayName(d: Date): string | null {
  const table = holidayJp.holidays as Record<string, { name: string } | undefined>;
  return table[dateKey(d)]?.name ?? null;
}

/** 日曜と祝日は朱、土曜は瑠璃にする */
export function dayTone(d: Date): "sun" | "sat" | null {
  if (d.getDay() === 0 || holidayName(d)) return "sun";
  if (d.getDay() === 6) return "sat";
  return null;
}

/** `9:00` の形にする */
export function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * 日付の書き方はこの 1 つの形にそろえる。曜日は付けない。決定 0059
 * `9.21`、`9/21`、`9月21日 月曜` は使わない。曜日を見せるのはカレンダーの形の中だけ(月の表の曜日の列、
 * 日のカードの「木曜」、週と日の表示の日の列、繰り返しの曜日の丸)で、そこは `WEEKDAYS` を直に使う
 * @param opts.year true なら `2026年9月21日` にする。年をまたぐ一覧など、年も要る場所で使う
 */
export function formatDay(d: Date, opts?: { year?: boolean }): string {
  const year = opts?.year ? `${d.getFullYear()}年` : "";
  return `${year}${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * `9月21日` の形にする。`dateKey` の文字列から `formatDay` を呼ぶ近道。決定 0059
 * @param dateKey `2026-09-21` の形。形が違えばそのまま返す
 */
export function formatShortDate(dateKey: string): string {
  const d = parseDateKey(dateKey);
  return d ? formatDay(d) : dateKey;
}

/**
 * ミリ秒を、指定した時間帯で数えて `formatDay` と同じ形にする。思い出など、端末と違う
 * 時間帯を持つ拡張で使う。画面ごとに Intl.DateTimeFormat を直に組み立てない。決定 0059
 */
export function formatDayAt(ms: number, timeZone: string | undefined, opts?: { year?: boolean }): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ms);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const d = new Date(Number(map.year), Number(map.month) - 1, Number(map.day));
  return formatDay(d, opts);
}

/**
 * 期間の見出し。同じ日なら 1 つ、違えば `9月19日〜9月20日` のようにつなぐ。決定 0059
 */
export function formatSpan(startsAt: number, endsAt: number, timeZone: string): string {
  const first = formatDayAt(startsAt, timeZone);
  const last = formatDayAt(endsAt - 1, timeZone);
  return first === last ? first : `${first}〜${last}`;
}

/** `<input type="time">` に入れる `09:00` の形にする */
export function toTimeInput(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * 日付に時刻を合わせたミリ秒を返す。
 * @param day 日付
 * @param hhmm `09:00` の形
 */
export function withTime(day: Date, hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h ?? 0, m ?? 0).getTime();
}

type Span = { startsAt: number; endsAt: number | null; allDay: boolean };

/** 項目がその日にかかるか。終わりが無いものは始まりの日だけ */
export function onDay(item: Span, day: Date): boolean {
  const from = startOfDay(day).getTime();
  const to = addDays(day, 1).getTime();
  const end = item.endsAt ?? item.startsAt;
  if (item.allDay) return item.startsAt < to && Math.max(end, item.startsAt + 1) > from;
  return item.startsAt < to && (item.endsAt == null ? item.startsAt >= from : end > from);
}
